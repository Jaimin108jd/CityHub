import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

// ─── Hugging Face Inference Providers (OpenAI-compatible) ───────────
// Free tier — no credit card, uses router.huggingface.co/v1 endpoint
// :fastest auto-selects the best available provider for each model
const HF_MODELS = [
    "Qwen/Qwen2.5-72B-Instruct:fastest",
    "meta-llama/Llama-3.1-8B-Instruct:fastest",
];
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
const MAX_RETRIES = 3;

function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

async function callLLM(prompt: string, systemInstruction?: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKey = (globalThis as any).process?.env?.HF_API_KEY as string | undefined;
    if (!apiKey) throw new Error("HF_API_KEY environment variable is not set");

    // OpenAI-compatible chat messages format
    const messages: { role: string; content: string }[] = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    // Try each model with exponential backoff retry on 429/503
    for (const model of HF_MODELS) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const response = await fetch(HF_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.2,
                    max_tokens: 1024,
                    stream: false,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                // OpenAI-compatible response: { choices: [{ message: { content } }] }
                return data.choices?.[0]?.message?.content?.trim() ?? "";
            }

            // Rate-limited (429) or model loading (503) — backoff and retry
            if (response.status === 429 || response.status === 503) {
                const backoff = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
                const reason = response.status === 503 ? "model loading" : "rate limited";
                console.warn(`HF ${reason} on ${model} (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms...`);
                await sleep(backoff);
                continue;
            }

            // Other errors — log and break to try next model
            const errorText = await response.text();
            console.error(`HF API error on ${model}:`, response.status, errorText);
            break;
        }
    }

    // All models exhausted — return sentinel instead of throwing
    return "__AI_UNAVAILABLE__";
}

// ─── 1. Content Moderation (DEPRECATED — replaced by inline AutoMod) ────
// The AI-based moderation below is no longer scheduled from sendMessage.
// It's replaced by the deterministic word-filter in convex/automod.ts
// which runs inline in the mutation for instant, reliable blocking.
// Kept here for backward compatibility / manual re-moderation if needed.

export const moderateMessage = internalAction({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        userId: v.string(),
        groupId: v.id("groups"),
        channelId: v.id("channels"),
    },
    handler: async (ctx, args) => {
        if (!args.content || args.content.trim().length < 3) return;

        try {
            const systemPrompt = `You are a content moderation system for a community chat platform (neighborhood groups, governance discussions, safety watches). 
Analyze the message and respond ONLY with valid JSON — no markdown, no code fences, no explanation.

Response format:
{
  "isFlagged": boolean,
  "category": "clean" | "toxic" | "hate_speech" | "harassment" | "spam" | "threat" | "sexual",
  "severity": "none" | "low" | "medium" | "high",
  "confidence": number (0-1),
  "reason": "brief explanation"
}

Rules:
- Flag hate speech, threats, harassment, spam, and sexual content.
- Be lenient with casual language, mild frustration, or passionate civic debate.
- "Low" severity = warning-worthy but not hidden. "Medium" = should be hidden. "High" = immediate action needed.
- Spam includes repeated promotional messages, crypto/NFT shilling, unsolicited ads.`;

            const result = await callLLM(
                `Moderate this community chat message:\n\n"${args.content}"`,
                systemPrompt
            );

            // If AI is unavailable, skip moderation silently (fail open)
            if (result === "__AI_UNAVAILABLE__") return;

            // Parse the JSON response
            const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
            const moderation = JSON.parse(cleaned);

            if (moderation.isFlagged && (moderation.severity === "medium" || moderation.severity === "high")) {
                // Flag the message in the database
                await ctx.runMutation(internal.ai.flagMessage, {
                    messageId: args.messageId,
                    category: moderation.category,
                    severity: moderation.severity,
                    confidence: moderation.confidence,
                    reason: moderation.reason,
                    userId: args.userId,
                    groupId: args.groupId,
                    channelId: args.channelId,
                });
            } else if (moderation.isFlagged && moderation.severity === "low") {
                // Log low-severity flags without hiding the message
                await ctx.runMutation(internal.ai.logModerationWarning, {
                    messageId: args.messageId,
                    category: moderation.category,
                    severity: moderation.severity,
                    reason: moderation.reason,
                    userId: args.userId,
                    groupId: args.groupId,
                });
            }
        } catch (error) {
            console.error("Moderation failed for message:", args.messageId, error);
            // Fail open — don't block messages if moderation errors
        }
    },
});

// ─── 2. Chat Summarization ("Catch Me Up") ──────────────────────────

export const summarizeChat = action({
    args: {
        channelId: v.id("channels"),
        messageCount: v.optional(v.number()), // default 50
    },
    handler: async (ctx, args) => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) throw new Error("Unauthorized");

        const count = args.messageCount ?? 50;

        // Fetch recent messages via internal query
        const messages: Array<{
            content: string;
            authorName: string;
            type: string;
            createdAt: number;
            pollQuestion?: string;
            transcription?: string;
        }> = await ctx.runQuery(internal.ai.getRecentMessagesForSummary, {
            channelId: args.channelId,
            count,
        });

        if (!messages || messages.length === 0) {
            return { summary: "No messages to summarize.", messageCount: 0 };
        }

        // Format messages for the LLM
        const formatted = messages
            .map((m) => {
                const time = new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                if (m.type === "poll") return `[${time}] 📊 ${m.authorName} created a poll: "${m.pollQuestion}"`;
                if (m.type === "image") return `[${time}] 📷 ${m.authorName} shared an image${m.content ? `: ${m.content}` : ""}`;
                if (m.type === "file") return `[${time}] 📎 ${m.authorName} shared a file: ${m.content}`;
                if (m.type === "voice") return `[${time}] 🎤 ${m.authorName} sent a voice message${m.transcription ? `: "${m.transcription}"` : ""}`;
                if (m.type === "system") return `[${time}] ⚙️ ${m.content}`;
                return `[${time}] ${m.authorName}: ${m.content}`;
            })
            .join("\n");

        const systemPrompt = `You are a helpful assistant that summarizes community group chat conversations.
Create a concise, well-structured summary using bullet points.

Rules:
- Group related topics together under clear headings.
- Highlight key decisions, action items, and important announcements.
- Mention who said what for important points.
- Keep it brief — max 8-10 bullet points.
- Use emojis sparingly for clarity.
- If there are polls, mention the question and outcome if visible.
- Ignore greetings, "lol", "ok", and other low-signal messages.
- Write in a friendly, neutral tone.`;

        try {
            const summary = await callLLM(
                `Summarize this community group chat conversation (${messages.length} messages):\n\n${formatted}`,
                systemPrompt
            );

            if (summary === "__AI_UNAVAILABLE__") {
                return {
                    summary: "⚠️ AI is temporarily busy. Please try again shortly.",
                    messageCount: messages.length,
                    error: true,
                };
            }

            return {
                summary,
                messageCount: messages.length,
                timeRange: {
                    from: messages[0].createdAt,
                    to: messages[messages.length - 1].createdAt,
                },
            };
        } catch (err) {
            console.error("AI summarize failed:", err);
            return {
                summary: "⚠️ Unable to generate summary right now. Please try again in a moment.",
                messageCount: messages.length,
                error: true,
            };
        }
    },
});

// ─── Internal Queries & Mutations for AI ────────────────────────────

import { internalMutation, internalQuery } from "./_generated/server";

export const getRecentMessagesForSummary = internalQuery({
    args: {
        channelId: v.id("channels"),
        count: v.number(),
    },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
            .order("desc")
            .take(args.count);

        // Enrich with author names and poll questions
        const enriched = await Promise.all(
            messages.reverse().map(async (msg) => {
                const author = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", msg.userId))
                    .first();

                let pollQuestion: string | undefined;
                if (msg.type === "poll" && msg.pollId) {
                    const poll = await ctx.db.get(msg.pollId);
                    pollQuestion = poll?.question;
                }

                return {
                    content: msg.content,
                    authorName: author?.name ?? "Unknown",
                    type: msg.type,
                    createdAt: msg.createdAt,
                    pollQuestion,
                    transcription: msg.transcription,
                };
            })
        );

        return enriched;
    },
});

export const flagMessage = internalMutation({
    args: {
        messageId: v.id("messages"),
        category: v.string(),
        severity: v.string(),
        confidence: v.number(),
        reason: v.string(),
        userId: v.string(),
        groupId: v.id("groups"),
        channelId: v.id("channels"),
    },
    handler: async (ctx, args) => {
        // Insert moderation flag record
        await ctx.db.insert("moderationFlags", {
            messageId: args.messageId,
            channelId: args.channelId,
            groupId: args.groupId,
            flaggedUserId: args.userId,
            category: args.category,
            severity: args.severity,
            confidence: args.confidence,
            reason: args.reason,
            status: args.severity === "high" ? "auto_hidden" : "flagged",
            reviewedBy: undefined,
            reviewedAt: undefined,
            createdAt: Date.now(),
        });

        // Mark the message as flagged
        await ctx.db.patch(args.messageId, {
            isFlagged: true,
            moderationStatus: args.severity === "high" ? "hidden" : "flagged",
        });

        // Notify group managers about flagged content
        const managers = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_role", (q) =>
                q.eq("groupId", args.groupId).eq("role", "manager")
            )
            .collect();

        // Also get founders
        const founders = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_role", (q) =>
                q.eq("groupId", args.groupId).eq("role", "founder")
            )
            .collect();

        const admins = [...managers, ...founders];

        for (const admin of admins) {
            await ctx.db.insert("notifications", {
                userId: admin.userId,
                type: "governance_alert",
                layer: "important",
                title: "Content Flagged",
                message: `A message was flagged as ${args.category} (${args.severity} severity): "${args.reason}"`,
                icon: "governance",
                data: {
                    messageId: args.messageId,
                    channelId: args.channelId,
                    category: args.category,
                    severity: args.severity,
                },
                groupId: args.groupId,
                isRead: false,
                createdAt: Date.now(),
            });
        }
    },
});

export const logModerationWarning = internalMutation({
    args: {
        messageId: v.id("messages"),
        category: v.string(),
        severity: v.string(),
        reason: v.string(),
        userId: v.string(),
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        // Log low-severity flags in governance logs for record-keeping
        await ctx.db.insert("governanceLogs", {
            groupId: args.groupId,
            actionType: "moderation_warning",
            actorId: "system",
            targetUserId: args.userId,
            details: `Low-severity ${args.category} detected: ${args.reason} (messageId: ${args.messageId})`,
            createdAt: Date.now(),
        });
    },
});

// ─── Manager Actions ────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";

// Managers can review and resolve flagged messages
export const reviewFlaggedMessage = mutation({
    args: {
        flagId: v.id("moderationFlags"),
        action: v.union(v.literal("approve"), v.literal("dismiss"), v.literal("hide")),
    },
    handler: async (ctx, args) => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) throw new Error("Unauthorized");

        const flag = await ctx.db.get(args.flagId);
        if (!flag) throw new Error("Flag not found");

        // Check if user is a manager of the group
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", flag.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can review flagged content");
        }

        if (args.action === "dismiss") {
            // False positive — unflag the message
            await ctx.db.patch(args.flagId, {
                status: "dismissed",
                reviewedBy: user._id,
                reviewedAt: Date.now(),
            });
            await ctx.db.patch(flag.messageId, {
                isFlagged: false,
                moderationStatus: "cleared",
            });
        } else if (args.action === "hide") {
            // Confirm — hide the message
            await ctx.db.patch(args.flagId, {
                status: "confirmed_hidden",
                reviewedBy: user._id,
                reviewedAt: Date.now(),
            });
            await ctx.db.patch(flag.messageId, {
                moderationStatus: "hidden",
            });
        } else if (args.action === "approve") {
            // Allow the message — it was safe
            await ctx.db.patch(args.flagId, {
                status: "approved",
                reviewedBy: user._id,
                reviewedAt: Date.now(),
            });
            await ctx.db.patch(flag.messageId, {
                isFlagged: false,
                moderationStatus: "cleared",
            });
        }

        // Log the review
        await ctx.db.insert("governanceLogs", {
            groupId: flag.groupId,
            actionType: "moderation_review",
            actorId: user._id,
            targetUserId: flag.flaggedUserId,
            details: `Reviewed flagged message: ${args.action} (${flag.category}, ${flag.severity})`,
            createdAt: Date.now(),
        });
    },
});

// Get flagged messages for a group (manager view)
export const getFlaggedMessages = query({
    args: {
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) throw new Error("Unauthorized");

        // Check manager access
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can view flagged content");
        }

        const flags = await ctx.db
            .query("moderationFlags")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .order("desc")
            .take(50);

        // Enrich with message content and user info
        const enriched = await Promise.all(
            flags.map(async (flag) => {
                const message = await ctx.db.get(flag.messageId);
                const user = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", flag.flaggedUserId))
                    .first();

                return {
                    ...flag,
                    messageContent: message?.content ?? "[deleted]",
                    userName: user?.name ?? "Unknown",
                };
            })
        );

        return enriched;
    },
});

// ─── AutoMod Dashboard Queries ──────────────────────────────────────

// Get all warnings + active timeouts per user for a group (manager view)
export const getAutoModStatus = query({
    args: {
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) throw new Error("Unauthorized");

        // Check manager access
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can view AutoMod status");
        }

        // Get all warnings for this group
        const warnings = await ctx.db
            .query("moderationWarnings")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .order("desc")
            .take(100);

        // Get all timeouts for this group
        const groupTimeouts = await ctx.db
            .query("userTimeouts")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId))
            .collect();

        // Aggregate by user
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const userMap = new Map<string, {
            userId: string;
            userName: string;
            avatarUrl: string | null;
            totalWarnings: number;
            recentWarnings: number; // last 24h
            lastWarningAt: number | null;
            lastCategory: string | null;
            isTimedOut: boolean;
            timeoutUntil: number | null;
            timeoutId: string | null;
        }>();

        for (const w of warnings) {
            if (!userMap.has(w.userId)) {
                const profile = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", w.userId))
                    .first();
                let avatarUrl: string | null = null;
                if (profile?.imageUrl) {
                    avatarUrl = await ctx.storage.getUrl(profile.imageUrl as any);
                }
                userMap.set(w.userId, {
                    userId: w.userId,
                    userName: profile?.name ?? "Unknown",
                    avatarUrl,
                    totalWarnings: 0,
                    recentWarnings: 0,
                    lastWarningAt: null,
                    lastCategory: null,
                    isTimedOut: false,
                    timeoutUntil: null,
                    timeoutId: null,
                });
            }
            const entry = userMap.get(w.userId)!;
            entry.totalWarnings++;
            if (w.createdAt > oneDayAgo) entry.recentWarnings++;
            if (!entry.lastWarningAt || w.createdAt > entry.lastWarningAt) {
                entry.lastWarningAt = w.createdAt;
                entry.lastCategory = w.category;
            }
        }

        // Overlay timeout info
        for (const t of groupTimeouts) {
            if (!userMap.has(t.userId)) {
                const profile = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", t.userId))
                    .first();
                let avatarUrl: string | null = null;
                if (profile?.imageUrl) {
                    avatarUrl = await ctx.storage.getUrl(profile.imageUrl as any);
                }
                userMap.set(t.userId, {
                    userId: t.userId,
                    userName: profile?.name ?? "Unknown",
                    avatarUrl,
                    totalWarnings: 0,
                    recentWarnings: 0,
                    lastWarningAt: null,
                    lastCategory: null,
                    isTimedOut: false,
                    timeoutUntil: null,
                    timeoutId: null,
                });
            }
            const entry = userMap.get(t.userId)!;
            if (t.timeoutUntil > now) {
                entry.isTimedOut = true;
                entry.timeoutUntil = t.timeoutUntil;
                entry.timeoutId = t._id;
            }
        }

        // Return sorted: timed-out first, then by warning count
        const users = Array.from(userMap.values()).sort((a, b) => {
            if (a.isTimedOut && !b.isTimedOut) return -1;
            if (!a.isTimedOut && b.isTimedOut) return 1;
            return b.totalWarnings - a.totalWarnings;
        });

        // Recent warning log (last 20)
        const recentWarningLog = await Promise.all(
            warnings.slice(0, 20).map(async (w) => {
                const profile = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", w.userId))
                    .first();
                return {
                    _id: w._id,
                    userId: w.userId,
                    userName: profile?.name ?? "Unknown",
                    category: w.category,
                    reason: w.reason,
                    warningNumber: w.warningNumber,
                    timeoutApplied: w.timeoutApplied,
                    createdAt: w.createdAt,
                };
            })
        );

        return { users, recentWarningLog };
    },
});

// Manager action: lift a timeout early
export const liftTimeout = mutation({
    args: {
        timeoutId: v.id("userTimeouts"),
    },
    handler: async (ctx, args) => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) throw new Error("Unauthorized");

        const timeout = await ctx.db.get(args.timeoutId);
        if (!timeout) throw new Error("Timeout not found");

        // Check manager access
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", timeout.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can lift timeouts");
        }

        // Set timeout to now (effectively lifting it)
        await ctx.db.patch(args.timeoutId, { timeoutUntil: Date.now() });

        // Governance log
        const targetProfile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", timeout.userId))
            .first();

        await ctx.db.insert("governanceLogs", {
            groupId: timeout.groupId,
            actionType: "timeout_lifted",
            actorId: user._id,
            targetUserId: timeout.userId,
            details: `Timeout lifted for ${targetProfile?.name ?? "Unknown"} by manager`,
            createdAt: Date.now(),
        });
    },
});

// ═══════════════════════════════════════════════════════════════════════
// 3. 🔍 Semantic Search & Discovery (Convex Vector Search)
// ═══════════════════════════════════════════════════════════════════════

// ─── Nomic Atlas Embedding (free tier — nomic-embed-text-v1.5) ──────
// 768 dimensions · Get a free key at: https://atlas.nomic.ai

const NOMIC_EMBEDDING_MODEL = "nomic-embed-text-v1.5";
const NOMIC_EMBEDDING_URL = "https://api-atlas.nomic.ai/v1/embedding/text";

async function generateEmbedding(text: string, taskType: "search_document" | "search_query" = "search_document"): Promise<number[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKey = (globalThis as any).process?.env?.NOMIC_API_KEY as string | undefined;
    if (!apiKey) throw new Error("NOMIC_API_KEY environment variable is not set");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const response = await fetch(NOMIC_EMBEDDING_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: NOMIC_EMBEDDING_MODEL,
                texts: [text],
                task_type: taskType,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            // Nomic format: { embeddings: [[...768 floats...]] }
            return data.embeddings[0];
        }

        if (response.status === 429 || response.status === 503) {
            const backoff = 1000 * Math.pow(2, attempt);
            console.warn(`Nomic embedding rate-limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms...`);
            await sleep(backoff);
            continue;
        }

        const errorText = await response.text();
        console.error("Nomic Embedding API error:", response.status, errorText);
        throw new Error(`Nomic Embedding API error: ${response.status}`);
    }

    throw new Error("Nomic Embedding API: all retries exhausted");
}

// ─── Index a group's embedding (called after create/update) ─────────

export const indexGroupEmbedding = internalAction({
    args: {
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        try {
            const group: any = await ctx.runQuery(internal.ai.getGroupForEmbedding, {
                groupId: args.groupId,
            });
            if (!group) return;

            // Combine name, description, category, and tags into a single text
            const text = [
                group.name,
                group.description,
                group.category,
                ...(group.tags || []),
                group.city?.name,
            ]
                .filter(Boolean)
                .join(" | ");

            const embedding = await generateEmbedding(text);

            // Upsert: delete existing embedding for this group, then insert
            await ctx.runMutation(internal.ai.upsertGroupEmbedding, {
                groupId: args.groupId,
                text,
                embedding,
            });
        } catch (error) {
            console.error("Failed to index group embedding:", args.groupId, error);
        }
    },
});

// ─── Index an event's embedding ─────────────────────────────────────

export const indexEventEmbedding = internalAction({
    args: {
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        try {
            const event: any = await ctx.runQuery(internal.ai.getEventForEmbedding, {
                eventId: args.eventId,
            });
            if (!event) return;

            const text = [
                event.title,
                event.description,
                event.category,
                event.location,
                event.groupName,
            ]
                .filter(Boolean)
                .join(" | ");

            const embedding = await generateEmbedding(text);

            await ctx.runMutation(internal.ai.upsertEventEmbedding, {
                eventId: args.eventId,
                groupId: event.groupId,
                text,
                embedding,
            });
        } catch (error) {
            console.error("Failed to index event embedding:", args.eventId, error);
        }
    },
});

// ─── Semantic Search Action ─────────────────────────────────────────

export const semanticSearch = action({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<{ groups: any[]; events: any[] }> => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) throw new Error("Unauthorized");

        const queryText = args.query.trim();
        if (!queryText) return { groups: [], events: [] };

        try {
            const embedding = await generateEmbedding(queryText, "search_query");
            const limit = args.limit ?? 10;

            // Search groups and events in parallel
            const [groupResults, eventResults] = await Promise.all([
                ctx.vectorSearch("groupEmbeddings", "by_embedding", {
                    vector: embedding,
                    limit,
                }),
                ctx.vectorSearch("eventEmbeddings", "by_embedding", {
                    vector: embedding,
                    limit,
                }),
            ]);

            // Enrich group results
            const groups = await ctx.runQuery(internal.ai.enrichGroupSearchResults, {
                results: groupResults.map((r) => ({
                    id: r._id,
                    score: r._score,
                })),
            });

            // Enrich event results
            const events = await ctx.runQuery(internal.ai.enrichEventSearchResults, {
                results: eventResults.map((r) => ({
                    id: r._id,
                    score: r._score,
                })),
            });

            return { groups, events };
        } catch (error) {
            console.error("Semantic search failed:", error);
            // Fall back to empty results
            return { groups: [], events: [] };
        }
    },
});

// ─── Internal helpers for semantic search ───────────────────────────

export const getGroupForEmbedding = internalQuery({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.groupId);
    },
});

export const getEventForEmbedding = internalQuery({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) return null;
        const group = await ctx.db.get(event.groupId);
        return { ...event, groupName: group?.name };
    },
});

export const upsertGroupEmbedding = internalMutation({
    args: {
        groupId: v.id("groups"),
        text: v.string(),
        embedding: v.array(v.float64()),
    },
    handler: async (ctx, args) => {
        // Remove existing embedding for this group
        const existing = await ctx.db
            .query("groupEmbeddings")
            .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
            .first();
        if (existing) await ctx.db.delete(existing._id);

        await ctx.db.insert("groupEmbeddings", {
            groupId: args.groupId,
            text: args.text,
            embedding: args.embedding,
        });
    },
});

export const upsertEventEmbedding = internalMutation({
    args: {
        eventId: v.id("events"),
        groupId: v.id("groups"),
        text: v.string(),
        embedding: v.array(v.float64()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("eventEmbeddings")
            .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
            .first();
        if (existing) await ctx.db.delete(existing._id);

        await ctx.db.insert("eventEmbeddings", {
            eventId: args.eventId,
            groupId: args.groupId,
            text: args.text,
            embedding: args.embedding,
        });
    },
});

export const enrichGroupSearchResults = internalQuery({
    args: {
        results: v.array(v.object({
            id: v.id("groupEmbeddings"),
            score: v.float64(),
        })),
    },
    handler: async (ctx, args) => {
        const enriched = await Promise.all(
            args.results.map(async (r) => {
                const embeddingDoc = await ctx.db.get(r.id);
                if (!embeddingDoc) return null;

                const group = await ctx.db.get(embeddingDoc.groupId);
                if (!group || !group.isPublic) return null;

                const members = await ctx.db
                    .query("groupMembers")
                    .withIndex("by_group", (q) => q.eq("groupId", group._id))
                    .collect();

                const coverImageUrl = group.coverImageId
                    ? await ctx.storage.getUrl(group.coverImageId)
                    : null;

                return {
                    ...group,
                    memberCount: members.length,
                    coverImageUrl,
                    searchScore: r.score,
                };
            })
        );
        return enriched.filter(Boolean);
    },
});

export const enrichEventSearchResults = internalQuery({
    args: {
        results: v.array(v.object({
            id: v.id("eventEmbeddings"),
            score: v.float64(),
        })),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const enriched = await Promise.all(
            args.results.map(async (r) => {
                const embeddingDoc = await ctx.db.get(r.id);
                if (!embeddingDoc) return null;

                const event = await ctx.db.get(embeddingDoc.eventId);
                if (!event) return null;

                const group = await ctx.db.get(event.groupId);

                return {
                    _id: event._id,
                    title: event.title,
                    description: event.description,
                    startTime: event.startTime,
                    location: event.location,
                    locationCoords: event.locationCoords,
                    eventType: event.eventType,
                    category: event.category || group?.category || "Other",
                    attendeeCount: event.attendees.length,
                    groupId: event.groupId,
                    groupName: group?.name || "Unknown",
                    isPast: event.startTime <= now,
                    searchScore: r.score,
                };
            })
        );
        return enriched.filter(Boolean);
    },
});

// ─── Batch index all groups (admin / migration utility) ─────────────

export const reindexAllGroups = internalAction({
    args: {},
    handler: async (ctx) => {
        const groups: any[] = await ctx.runQuery(internal.ai.getAllGroupIds);
        for (const groupId of groups) {
            await ctx.runAction(internal.ai.indexGroupEmbedding, { groupId });
        }
        console.log(`Reindexed ${groups.length} group embeddings`);
    },
});

export const reindexAllEvents = internalAction({
    args: {},
    handler: async (ctx) => {
        const events: any[] = await ctx.runQuery(internal.ai.getAllEventIds);
        for (const eventId of events) {
            await ctx.runAction(internal.ai.indexEventEmbedding, { eventId });
        }
        console.log(`Reindexed ${events.length} event embeddings`);
    },
});

export const getAllGroupIds = internalQuery({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("groups").collect();
        return groups.map((g) => g._id);
    },
});

export const getAllEventIds = internalQuery({
    args: {},
    handler: async (ctx) => {
        const events = await ctx.db.query("events").collect();
        return events.map((e) => e._id);
    },
});

// ─── Sync missing embeddings (only indexes unindexed items) ─────────

export const getUnindexedGroupIds = internalQuery({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("groups").collect();
        const unindexed: string[] = [];
        for (const group of groups) {
            const existing = await ctx.db
                .query("groupEmbeddings")
                .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
                .first();
            if (!existing) unindexed.push(group._id);
        }
        return unindexed;
    },
});

export const getUnindexedEventIds = internalQuery({
    args: {},
    handler: async (ctx) => {
        const events = await ctx.db.query("events").collect();
        const unindexed: string[] = [];
        for (const event of events) {
            const existing = await ctx.db
                .query("eventEmbeddings")
                .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
                .first();
            if (!existing) unindexed.push(event._id);
        }
        return unindexed;
    },
});

export const syncMissingEmbeddings = internalAction({
    args: {},
    handler: async (ctx) => {
        const [unindexedGroups, unindexedEvents] = await Promise.all([
            ctx.runQuery(internal.ai.getUnindexedGroupIds),
            ctx.runQuery(internal.ai.getUnindexedEventIds),
        ]);

        for (const groupId of unindexedGroups) {
            await ctx.runAction(internal.ai.indexGroupEmbedding, { groupId: groupId as any });
        }
        for (const eventId of unindexedEvents) {
            await ctx.runAction(internal.ai.indexEventEmbedding, { eventId: eventId as any });
        }

        if (unindexedGroups.length || unindexedEvents.length) {
            console.log(`Synced embeddings: ${unindexedGroups.length} groups, ${unindexedEvents.length} events`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════════
// 5. 🎙️ Voice-to-Text Transcription (HuggingFace Whisper — free)
// ═══════════════════════════════════════════════════════════════════════

const HF_WHISPER_MODEL = "openai/whisper-large-v3-turbo";
const HF_WHISPER_URL = `https://router.huggingface.co/hf-inference/models/${HF_WHISPER_MODEL}`;

export const transcribeVoiceMessage = internalAction({
    args: {
        messageId: v.id("messages"),
        fileId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        try {
            // Mark as pending
            await ctx.runMutation(internal.ai.updateTranscription, {
                messageId: args.messageId,
                status: "pending",
            });

            // Get the audio file URL from storage
            const fileUrl = await ctx.storage.getUrl(args.fileId);
            if (!fileUrl) {
                await ctx.runMutation(internal.ai.updateTranscription, {
                    messageId: args.messageId,
                    status: "failed",
                });
                return;
            }

            // Download the audio file
            const audioResponse = await fetch(fileUrl);
            if (!audioResponse.ok) {
                throw new Error(`Failed to download audio: ${audioResponse.status}`);
            }
            const audioBlob = await audioResponse.blob();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const apiKey = (globalThis as any).process?.env?.HF_API_KEY as string | undefined;
            if (!apiKey) throw new Error("HF_API_KEY environment variable is not set");

            // HF Inference API for ASR: just POST the raw audio bytes
            let transcription: string | null = null;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                const whisperResponse = await fetch(HF_WHISPER_URL, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    body: audioBlob,
                });

                if (whisperResponse.ok) {
                    const result = await whisperResponse.json();
                    transcription = result.text?.trim() ?? null;
                    break;
                }

                // Rate-limited or model loading — backoff and retry
                if (whisperResponse.status === 429 || whisperResponse.status === 503) {
                    const backoff = 1000 * Math.pow(2, attempt);
                    const reason = whisperResponse.status === 503 ? "model loading" : "rate limited";
                    console.warn(`HF Whisper ${reason} (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms...`);
                    await sleep(backoff);
                    continue;
                }

                const errorText = await whisperResponse.text();
                console.error("HF Whisper API error:", whisperResponse.status, errorText);
                throw new Error(`HF Whisper API error: ${whisperResponse.status}`);
            }

            if (transcription) {
                await ctx.runMutation(internal.ai.updateTranscription, {
                    messageId: args.messageId,
                    transcription,
                    status: "completed",
                });
            } else {
                await ctx.runMutation(internal.ai.updateTranscription, {
                    messageId: args.messageId,
                    status: "failed",
                });
            }
        } catch (error) {
            console.error("Voice transcription failed for message:", args.messageId, error);
            await ctx.runMutation(internal.ai.updateTranscription, {
                messageId: args.messageId,
                status: "failed",
            });
        }
    },
});

export const updateTranscription = internalMutation({
    args: {
        messageId: v.id("messages"),
        transcription: v.optional(v.string()),
        status: v.string(), // "pending" | "completed" | "failed"
    },
    handler: async (ctx, args) => {
        const update: Record<string, any> = {
            transcriptionStatus: args.status,
        };
        if (args.transcription !== undefined) {
            update.transcription = args.transcription;
        }
        await ctx.db.patch(args.messageId, update);
    },
});

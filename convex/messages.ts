import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { checkContentFilter, getTimeoutDuration } from "./automod";

async function getAuthUserSafe(ctx: any) {
    try {
        return await authComponent.getAuthUser(ctx);
    } catch {
        return null;
    }
}

export const listMessages = query({
    args: {
        channelId: v.id("channels"),
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        const userId = user?._id;

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
            .order("desc") // Latest first
            .paginate(args.paginationOpts);

        // Enrich messages with user details and poll data
        const enrichedMessages = await Promise.all(
            messages.page.map(async (msg) => {
                // Fetch Author (handle synthetic "automod" user)
                const author = msg.userId === "automod"
                    ? { name: "AutoMod", imageUrl: null }
                    : await ctx.db
                        .query("users")
                        .withIndex("by_userId", (q) => q.eq("userId", msg.userId))
                        .first();

                // Fetch Poll Data if applicable
                let poll = undefined;
                let userVote: number | undefined = undefined;
                let userVoteIndices: number[] | undefined = undefined;

                if (msg.type === "poll" && msg.pollId) {
                    poll = await ctx.db.get(msg.pollId);
                    if (poll && userId) {
                        const vote = await ctx.db
                            .query("pollVotes")
                            .withIndex("by_poll_user", (q) => q.eq("pollId", msg.pollId!).eq("userId", userId))
                            .first();
                        if (vote) {
                            userVote = vote.optionIndex ?? vote.rating ?? (vote.optionIndices ? vote.optionIndices[0] : (vote.textResponse !== undefined ? 0 : undefined));
                            userVoteIndices = vote.optionIndices;
                        }
                    }
                }

                // Resolve file URL from storage
                let fileUrl: string | null = null;
                if (msg.fileId) {
                    fileUrl = await ctx.storage.getUrl(msg.fileId);
                }

                // Resolve author avatar URL from storage
                let authorAvatarUrl: string | null = null;
                if (author?.imageUrl) {
                    authorAvatarUrl = await ctx.storage.getUrl(author.imageUrl as any);
                }

                // Resolve parent message (for replies)
                let parentMessage = null;
                if (msg.parentMessageId) {
                    const parent = await ctx.db.get(msg.parentMessageId);
                    if (parent) {
                        const parentAuthor = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", parent.userId)).first();
                        parentMessage = {
                            _id: parent._id,
                            content: parent.content,
                            author: parentAuthor ? { name: parentAuthor.name } : null,
                            type: parent.type,
                        };
                    }
                }

                // Fetch moderation flag if flagged
                let moderationFlag = null;
                if (msg.isFlagged) {
                    moderationFlag = await ctx.db
                        .query("moderationFlags")
                        .withIndex("by_message", (q) => q.eq("messageId", msg._id))
                        .first();
                }

                return {
                    ...msg,
                    author: author ? { name: author.name, avatarUrl: authorAvatarUrl } : null,
                    poll: poll ? { ...poll, userVote, userVoteIndices } : null,
                    fileUrl,
                    parentMessage,
                    moderationFlag: moderationFlag ? {
                        _id: moderationFlag._id,
                        category: moderationFlag.category,
                        severity: moderationFlag.severity,
                        status: moderationFlag.status,
                        reason: moderationFlag.reason,
                    } : null,
                };
            })
        );

        return {
            ...messages,
            page: enrichedMessages,
        };
    },
});

// ─── Get current user's active timeout for a group (for live countdown) ───
export const getMyTimeout = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        const timeout = await ctx.db
            .query("userTimeouts")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!timeout || timeout.timeoutUntil <= Date.now()) return null;
        return { timeoutUntil: timeout.timeoutUntil };
    },
});

export const sendMessage = mutation({
    args: {
        clientSideId: v.optional(v.string()),
        channelId: v.id("channels"),
        content: v.string(),
        type: v.union(v.literal("text"), v.literal("image"), v.literal("file"), v.literal("poll"), v.literal("voice"), v.literal("system")),
        pollId: v.optional(v.id("polls")),
        fileId: v.optional(v.id("_storage")),
        parentMessageId: v.optional(v.id("messages")),
        mentions: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const channel = await ctx.db.get(args.channelId);
        if (!channel) throw new Error("Channel not found");

        // Permission: Must be member
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", channel.groupId).eq("userId", user._id))
            .first();

        if (!membership) throw new Error("Must be a member to post");

        // Permission: Manager Only
        if (channel.isManagerOnlyPost && membership.role !== "manager" && membership.role !== "founder") {
            throw new Error("Only managers can post in this channel");
        }

        // ─── AutoMod: Check if user is timed out ───
        if (args.type === "text") {
            const activeTimeout = await ctx.db
                .query("userTimeouts")
                .withIndex("by_group_user", (q) => q.eq("groupId", channel.groupId).eq("userId", user._id))
                .first();
            if (activeTimeout && activeTimeout.timeoutUntil > Date.now()) {
                const remaining = Math.ceil((activeTimeout.timeoutUntil - Date.now()) / 60000);
                throw new Error(`You are timed out for ${remaining} more minute(s)`);
            }
        }

        // ─── AutoMod: Content filter (Discord-like) ───
        let isAutoModBlocked = false;
        let autoModResult: ReturnType<typeof checkContentFilter> | null = null;
        if (args.type === "text" && args.content.trim().length >= 1) {
            const result = checkContentFilter(args.content);
            if (result.isBlocked) {
                isAutoModBlocked = true;
                autoModResult = result;
            }
        }

        const messageId = await ctx.db.insert("messages", {
            channelId: args.channelId,
            groupId: channel.groupId,
            userId: user._id,
            content: args.content,
            type: args.type,
            pollId: args.pollId,
            fileId: args.fileId,
            parentMessageId: args.parentMessageId,
            mentions: args.mentions,
            clientSideId: args.clientSideId,
            createdAt: Date.now(),
            reactions: [],
            ...(isAutoModBlocked ? { isFlagged: true, moderationStatus: "automod_blocked" } : {}),
        });

        // Update channel activity
        await ctx.db.patch(args.channelId, { lastMessageAt: Date.now() });

        // ─── AutoMod: Handle violation (warn → timeout → log) ───
        if (isAutoModBlocked && autoModResult) {
            const profile = await ctx.db.query("users")
                .withIndex("by_userId", (q) => q.eq("userId", user._id)).first();
            const userName = profile?.name ?? "Unknown";

            // Count recent warnings (24h rolling window — old violations decay)
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const existingWarnings = await ctx.db
                .query("moderationWarnings")
                .withIndex("by_group_user", (q) => q.eq("groupId", channel.groupId).eq("userId", user._id))
                .collect();
            const recentWarnings = existingWarnings.filter(w => w.createdAt > oneDayAgo);
            const warningCount = recentWarnings.length + 1;

            // Escalating timeout (1 = warn, 2 = 5m, 3 = 30m, 4+ = 1h)
            const timeout = getTimeoutDuration(warningCount);
            let timeoutMsg = "";

            if (timeout) {
                const existingTimeout = await ctx.db
                    .query("userTimeouts")
                    .withIndex("by_group_user", (q) => q.eq("groupId", channel.groupId).eq("userId", user._id))
                    .first();

                const timeoutUntil = Date.now() + timeout.duration;
                if (existingTimeout) {
                    await ctx.db.patch(existingTimeout._id, {
                        timeoutUntil, reason: autoModResult.reason, warningCount,
                    });
                } else {
                    await ctx.db.insert("userTimeouts", {
                        groupId: channel.groupId, userId: user._id, timeoutUntil,
                        reason: autoModResult.reason, warningCount,
                        issuedBy: "automod", createdAt: Date.now(),
                    });
                }
                timeoutMsg = ` Timed out for ${timeout.label}.`;
            }

            // Record warning
            await ctx.db.insert("moderationWarnings", {
                groupId: channel.groupId, userId: user._id, channelId: args.channelId,
                blockedContent: args.content, category: autoModResult.category,
                reason: autoModResult.reason, warningNumber: warningCount,
                timeoutApplied: timeout?.duration, createdAt: Date.now(),
            });

            // Create moderation flag for manager review UI
            await ctx.db.insert("moderationFlags", {
                messageId, channelId: args.channelId, groupId: channel.groupId,
                flaggedUserId: user._id, category: autoModResult.category,
                severity: (autoModResult.category === "slur" || autoModResult.category === "threat") ? "high" : "medium",
                confidence: 1.0, reason: autoModResult.reason,
                status: "auto_hidden", createdAt: Date.now(),
            });

            // Governance log
            await ctx.db.insert("governanceLogs", {
                groupId: channel.groupId, actionType: "automod_block",
                actorId: "automod", targetUserId: user._id,
                details: `Warning ${warningCount}: Blocked for ${autoModResult.category} — "${autoModResult.reason}".${timeoutMsg}`,
                createdAt: Date.now(),
            });

            // Notify the user
            await ctx.db.insert("notifications", {
                userId: user._id, type: "governance_alert", layer: "critical",
                title: "Message Blocked by AutoMod",
                message: `Your message was blocked: ${autoModResult.reason}. Warning ${warningCount}.${timeoutMsg}`,
                icon: "governance", data: { groupId: channel.groupId, channelId: args.channelId },
                groupId: channel.groupId, isRead: false, createdAt: Date.now(),
            });

            // Notify managers/founders
            const managers = await ctx.db.query("groupMembers")
                .withIndex("by_group_role", (q) => q.eq("groupId", channel.groupId).eq("role", "manager")).collect();
            const founders = await ctx.db.query("groupMembers")
                .withIndex("by_group_role", (q) => q.eq("groupId", channel.groupId).eq("role", "founder")).collect();
            for (const admin of [...managers, ...founders]) {
                if (admin.userId !== user._id) {
                    await ctx.db.insert("notifications", {
                        userId: admin.userId, type: "governance_alert", layer: "important",
                        title: "AutoMod: Message Blocked",
                        message: `${userName}'s message was blocked (${autoModResult.category}). Warning ${warningCount}.${timeoutMsg}`,
                        icon: "governance",
                        data: { groupId: channel.groupId, channelId: args.channelId, messageId },
                        groupId: channel.groupId, isRead: false, createdAt: Date.now(),
                    });
                }
            }

            return messageId;
        }

        // Schedule voice transcription for voice messages
        if (args.type === "voice" && args.fileId) {
            await ctx.scheduler.runAfter(0, internal.ai.transcribeVoiceMessage, {
                messageId,
                fileId: args.fileId,
            });
        }

        // Notifications
        if (args.mentions && args.mentions.length > 0) {
            for (const mentionedUserId of args.mentions) {
                if (mentionedUserId !== user._id) {
                    await ctx.db.insert("notifications", {
                        userId: mentionedUserId,
                        type: "mention",
                        layer: "critical",
                        title: "You were mentioned",
                        message: `${user.name} mentioned you in #${channel.name}`,
                        icon: "message",
                        data: { groupId: channel.groupId, channelId: channel._id, messageId },
                        groupId: channel.groupId,
                        isRead: false,
                        createdAt: Date.now(),
                    });
                }
            }
        }

        // Clear typing
        const typingEntry = await ctx.db
            .query("typingIndicators")
            .withIndex("by_channel_user", (q) =>
                q.eq("channelId", args.channelId).eq("userId", user._id)
            )
            .first();
        if (typingEntry) {
            await ctx.db.delete(typingEntry._id);
        }

        return messageId;
    },
});

export const toggleReaction = mutation({
    args: {
        messageId: v.id("messages"),
        emoji: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const reactions = message.reactions || [];
        const existingReactionIndex = reactions.findIndex((r) => r.emoji === args.emoji);

        if (existingReactionIndex !== -1) {
            const existingReaction = reactions[existingReactionIndex];
            const userIndex = existingReaction.users.indexOf(user._id);

            if (userIndex !== -1) {
                existingReaction.users.splice(userIndex, 1);
                if (existingReaction.users.length === 0) {
                    reactions.splice(existingReactionIndex, 1);
                }
            } else {
                existingReaction.users.push(user._id);
            }
        } else {
            reactions.push({
                emoji: args.emoji,
                users: [user._id],
            });
        }

        await ctx.db.patch(args.messageId, { reactions });
    },
});

export const deleteMessage = mutation({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        if (message.userId !== user._id) throw new Error("You can only delete your own messages");

        if (message.fileId) {
            await ctx.storage.delete(message.fileId);
        }

        if (message.pollId) {
            const poll = await ctx.db.get(message.pollId);
            if (poll) await ctx.db.patch(message.pollId, { isActive: false });
        }

        await ctx.db.delete(args.messageId);
    },
});

export const setTyping = mutation({
    args: { channelId: v.id("channels") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return;

        const profile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        const existing = await ctx.db
            .query("typingIndicators")
            .withIndex("by_channel_user", (q) =>
                q.eq("channelId", args.channelId).eq("userId", user._id)
            )
            .first();

        const expiresAt = Date.now() + 3000;

        if (existing) {
            await ctx.db.patch(existing._id, { expiresAt });
        } else {
            await ctx.db.insert("typingIndicators", {
                channelId: args.channelId,
                userId: user._id,
                userName: profile?.name || "Someone",
                expiresAt,
            });
        }
    },
});

export const clearTyping = mutation({
    args: { channelId: v.id("channels") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return;

        const existing = await ctx.db
            .query("typingIndicators")
            .withIndex("by_channel_user", (q) =>
                q.eq("channelId", args.channelId).eq("userId", user._id)
            )
            .first();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});

export const getTypingUsers = query({
    args: { channelId: v.id("channels") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        const now = Date.now();

        const indicators = await ctx.db
            .query("typingIndicators")
            .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
            .collect();

        return indicators
            .filter((t) => t.expiresAt > now && t.userId !== user?._id)
            .map((t) => ({ userId: t.userId, userName: t.userName }));
    },
});

export const editMessage = mutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");
        if (message.userId !== user._id) throw new Error("Unauthorized");

        // ─── AutoMod: Check edited content ───
        if (args.content.trim().length >= 1) {
            const result = checkContentFilter(args.content);
            if (result.isBlocked) {
                throw new Error(`AutoMod: Edit blocked — ${result.reason}`);
            }
        }

        await ctx.db.patch(args.messageId, {
            content: args.content,
            editedAt: Date.now(),
        });
    },
});

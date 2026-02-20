import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";
import { requireGovernanceHealthy } from "./governance";

async function getAuthUserSafe(ctx: any) {
    try {
        return await authComponent.getAuthUser(ctx);
    } catch {
        return null;
    }
}

export const createPoll = mutation({
    args: {
        channelId: v.id("channels"),
        question: v.string(),
        pollType: v.optional(v.string()), // "single_choice" | "multiple_choice" | "yes_no" | "rating" | "feedback"
        options: v.array(v.string()),
        isAnonymous: v.optional(v.boolean()),
        allowMultiple: v.optional(v.boolean()),
        expiresInMinutes: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const channel = await ctx.db.get(args.channelId);
        if (!channel) throw new Error("Channel not found");

        // Governance Check
        await requireGovernanceHealthy(ctx.db, channel.groupId);

        const pollType = args.pollType || "single_choice";

        // Build options based on poll type
        let dbOptions: { label: string; count: number }[];
        if (pollType === "yes_no") {
            dbOptions = [
                { label: "Yes", count: 0 },
                { label: "No", count: 0 },
            ];
        } else if (pollType === "rating") {
            dbOptions = [1, 2, 3, 4, 5].map(n => ({ label: String(n), count: 0 }));
        } else if (pollType === "feedback") {
            dbOptions = [];
        } else {
            dbOptions = args.options.map(label => ({ label, count: 0 }));
        }

        const pollId = await ctx.db.insert("polls", {
            channelId: args.channelId,
            groupId: channel.groupId,
            question: args.question,
            pollType,
            options: dbOptions,
            isAnonymous: args.isAnonymous ?? false,
            allowMultiple: args.allowMultiple ?? (pollType === "multiple_choice"),
            createdBy: user._id,
            createdAt: Date.now(),
            expiresAt: args.expiresInMinutes ? Date.now() + args.expiresInMinutes * 60000 : undefined,
            isActive: true,
        });

        // Send a message of type "poll" so it appears in the chat
        await ctx.db.insert("messages", {
            channelId: args.channelId,
            groupId: channel.groupId,
            userId: user._id,
            content: args.question,
            type: "poll",
            pollId,
            createdAt: Date.now(),
        });

        // Update channel activity
        await ctx.db.patch(args.channelId, { lastMessageAt: Date.now() });

        // 🟡 Notify group members about new poll (Important)
        const group = await ctx.db.get(channel.groupId);
        if (group) {
            const members = await ctx.db
                .query("groupMembers")
                .withIndex("by_group", (q) => q.eq("groupId", channel.groupId))
                .collect();
            const profile = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", user._id)).first();
            const creatorName = profile?.name ?? "Someone";
            for (const m of members) {
                if (m.userId !== user._id) {
                    await ctx.db.insert("notifications", {
                        userId: m.userId,
                        type: "poll_created",
                        layer: "important",
                        title: "New Poll",
                        message: `${creatorName} created a poll: "${args.question}" in #${channel.name}`,
                        icon: "vote",
                        data: { groupId: channel.groupId, channelId: channel._id, pollId },
                        groupId: channel.groupId,
                        isRead: false,
                        createdAt: Date.now(),
                    });
                }
            }
        }

        return pollId;
    },
});

export const votePoll = mutation({
    args: {
        pollId: v.id("polls"),
        optionIndex: v.optional(v.number()),
        optionIndices: v.optional(v.array(v.number())),
        rating: v.optional(v.number()),
        textResponse: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const poll = await ctx.db.get(args.pollId);
        if (!poll) throw new Error("Poll not found");
        if (!poll.isActive) throw new Error("Poll is closed");
        if (poll.expiresAt && Date.now() > poll.expiresAt) throw new Error("Poll has expired");

        const pollType = poll.pollType || "single_choice";

        // Check if already voted
        const existingVote = await ctx.db
            .query("pollVotes")
            .withIndex("by_poll_user", (q) => q.eq("pollId", args.pollId).eq("userId", user._id))
            .first();

        if (pollType === "feedback") {
            if (existingVote) return { alreadyVoted: true };
            if (!args.textResponse?.trim()) throw new Error("Please enter your feedback");

            await ctx.db.insert("pollVotes", {
                pollId: args.pollId,
                userId: user._id,
                textResponse: args.textResponse.trim(),
                createdAt: Date.now(),
            });
            return;
        }

        if (existingVote) return { alreadyVoted: true };

        if (pollType === "rating") {
            const ratingIdx = args.rating !== undefined ? args.rating - 1 : args.optionIndex;
            if (ratingIdx === undefined || ratingIdx < 0 || ratingIdx > 4) throw new Error("Invalid rating");

            await ctx.db.insert("pollVotes", {
                pollId: args.pollId,
                userId: user._id,
                optionIndex: ratingIdx,
                rating: ratingIdx + 1,
                createdAt: Date.now(),
            });

            const newOptions = [...poll.options];
            if (newOptions[ratingIdx]) {
                newOptions[ratingIdx].count++;
            }
            await ctx.db.patch(args.pollId, { options: newOptions });
            return;
        }

        if (pollType === "multiple_choice") {
            const indices = args.optionIndices;
            if (!indices || indices.length === 0) throw new Error("Please select at least one option");

            await ctx.db.insert("pollVotes", {
                pollId: args.pollId,
                userId: user._id,
                optionIndices: indices,
                createdAt: Date.now(),
            });

            const newOptions = [...poll.options];
            for (const idx of indices) {
                if (newOptions[idx]) {
                    newOptions[idx].count++;
                }
            }
            await ctx.db.patch(args.pollId, { options: newOptions });
            return;
        }

        // Single choice / yes_no
        const optionIndex = args.optionIndex;
        if (optionIndex === undefined) throw new Error("Please select an option");

        await ctx.db.insert("pollVotes", {
            pollId: args.pollId,
            userId: user._id,
            optionIndex,
            createdAt: Date.now(),
        });

        const newOptions = [...poll.options];
        if (newOptions[optionIndex]) {
            newOptions[optionIndex].count++;
        }
        await ctx.db.patch(args.pollId, { options: newOptions });
    },
});

export const getPoll = query({
    args: { pollId: v.id("polls") },
    handler: async (ctx, args) => {
        const poll = await ctx.db.get(args.pollId);
        if (!poll) return null;

        // Auto-close expired polls on read
        if (poll.expiresAt && Date.now() > poll.expiresAt && poll.isActive) {
            // Can't mutate in a query, but mark it in the return
            return { ...poll, isActive: false, _expired: true };
        }

        const allVotes = await ctx.db
            .query("pollVotes")
            .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
            .collect();

        // Get voter names (limit to 10 for perf, skip if anonymous)
        let recentVoters: { name: string; userId: string }[] = [];
        if (!poll.isAnonymous) {
            const latestVotes = allVotes.slice(-10);
            recentVoters = await Promise.all(
                latestVotes.map(async (v) => {
                    const u = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", v.userId)).first();
                    return { name: u?.name || "Unknown", userId: v.userId };
                })
            );
        }

        return {
            ...poll,
            totalVoterCount: allVotes.length,
            recentVoters,
        };
    },
});

export const getUserVote = query({
    args: { pollId: v.id("polls") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;
        return await ctx.db
            .query("pollVotes")
            .withIndex("by_poll_user", (q) => q.eq("pollId", args.pollId).eq("userId", user._id))
            .first();
    }
});

export const getPollResponses = query({
    args: { pollId: v.id("polls") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        const poll = await ctx.db.get(args.pollId);
        if (!poll) return [];

        const votes = await ctx.db
            .query("pollVotes")
            .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
            .collect();

        if (poll.isAnonymous) {
            return votes.map(v => ({
                ...v,
                userId: "anonymous",
                userName: "Anonymous",
            }));
        }

        return Promise.all(
            votes.map(async (vote) => {
                const voteUser = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q: any) => q.eq("userId", vote.userId))
                    .first();
                return {
                    ...vote,
                    userName: voteUser?.name || "Unknown",
                };
            })
        );
    },
});

export const getGroupPollHistory = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q: any) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership) return [];

        const polls = await ctx.db
            .query("polls")
            .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
            .collect();

        return Promise.all(
            polls
                .sort((a, b) => b.createdAt - a.createdAt)
                .map(async (poll) => {
                    const creator = await ctx.db
                        .query("users")
                        .withIndex("by_userId", (q: any) => q.eq("userId", poll.createdBy))
                        .first();
                    const totalVotes = await ctx.db
                        .query("pollVotes")
                        .withIndex("by_poll", (q: any) => q.eq("pollId", poll._id))
                        .collect();
                    const myVote = totalVotes.find(v => v.userId === user._id);

                    return {
                        ...poll,
                        creatorName: creator?.name || "Unknown",
                        totalVoteCount: totalVotes.length,
                        userVote: myVote?.optionIndex ?? undefined,
                        hasVoted: !!myVote,
                    };
                })
        );
    },
});

export const retractVote = mutation({
    args: { pollId: v.id("polls") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const poll = await ctx.db.get(args.pollId);
        if (!poll) throw new Error("Poll not found");
        if (!poll.isActive) throw new Error("Poll is closed");
        if (poll.expiresAt && Date.now() > poll.expiresAt) throw new Error("Poll has expired");

        const existingVote = await ctx.db
            .query("pollVotes")
            .withIndex("by_poll_user", (q) => q.eq("pollId", args.pollId).eq("userId", user._id))
            .first();

        if (!existingVote) throw new Error("You haven't voted yet");

        // Decrement counts
        const newOptions = [...poll.options];
        const pollType = poll.pollType || "single_choice";

        if (pollType === "multiple_choice" && existingVote.optionIndices) {
            for (const idx of existingVote.optionIndices) {
                if (newOptions[idx]) newOptions[idx].count = Math.max(0, newOptions[idx].count - 1);
            }
        } else if (existingVote.optionIndex !== undefined) {
            if (newOptions[existingVote.optionIndex]) {
                newOptions[existingVote.optionIndex].count = Math.max(0, newOptions[existingVote.optionIndex].count - 1);
            }
        }

        if (pollType !== "feedback") {
            await ctx.db.patch(args.pollId, { options: newOptions });
        }
        await ctx.db.delete(existingVote._id);
    },
});

export const closePoll = mutation({
    args: { pollId: v.id("polls") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const poll = await ctx.db.get(args.pollId);
        if (!poll) throw new Error("Poll not found");

        if (poll.createdBy !== user._id) {
            const membership = await ctx.db
                .query("groupMembers")
                .withIndex("by_group_user", (q: any) =>
                    q.eq("groupId", poll.groupId).eq("userId", user._id)
                )
                .first();
            if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
                throw new Error("Only the poll creator or managers can close a poll");
            }
        }

        await ctx.db.patch(args.pollId, { isActive: false });
    },
});

// ─── Auto-close expired polls (called by cron) ───
export const closeExpiredPolls = internalMutation({
    handler: async (ctx) => {
        const now = Date.now();
        // Find all active polls — check expiresAt
        const activePolls = await ctx.db
            .query("polls")
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

        let closed = 0;
        for (const poll of activePolls) {
            if (poll.expiresAt && poll.expiresAt <= now) {
                await ctx.db.patch(poll._id, { isActive: false });
                closed++;
            }
        }
        return { closed };
    },
});

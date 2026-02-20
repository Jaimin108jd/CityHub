import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireGovernanceHealthy } from "./governance";

// Safe auth helper
async function getAuthUserSafe(ctx: any) {
    try {
        return await authComponent.getAuthUser(ctx);
    } catch {
        return null; // Return null if not authenticated
    }
}

export const listChannels = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        // TODO: Access control (members only?)
        return await ctx.db
            .query("channels")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
    },
});

export const getChannelSubscription = query({
    args: { channelId: v.id("channels") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        return await ctx.db
            .query("channelSubscriptions")
            .withIndex("by_user_channel", (q) => q.eq("userId", user._id).eq("channelId", args.channelId))
            .first();
    },
});

export const toggleChannelMute = mutation({
    args: { channelId: v.id("channels") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const channel = await ctx.db.get(args.channelId);
        if (!channel) throw new Error("Channel not found");

        const existing = await ctx.db
            .query("channelSubscriptions")
            .withIndex("by_user_channel", (q) => q.eq("userId", user._id).eq("channelId", args.channelId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { isMuted: !existing.isMuted });
            return !existing.isMuted;
        } else {
            await ctx.db.insert("channelSubscriptions", {
                userId: user._id,
                channelId: args.channelId,
                groupId: channel.groupId,
                isMuted: true,
                lastReadAt: Date.now(),
            });
            return true;
        }
    },
});

export const getAllChannelSubscriptions = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        return await ctx.db
            .query("channelSubscriptions")
            .withIndex("by_user_group", (q) => q.eq("userId", user._id).eq("groupId", args.groupId))
            .collect();
    },
});

export const createChannel = mutation({
    args: {
        groupId: v.id("groups"),
        name: v.string(),
        purpose: v.optional(v.string()),
        isManagerOnlyPost: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Check manager role
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", user._id))
            .first();

        // ...

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can create channels");
        }

        // Governance Check
        await requireGovernanceHealthy(ctx.db, args.groupId);

        // Limit check
        const channels = await ctx.db
            .query("channels")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();

        if (channels.length >= 20) {
            throw new Error("Max 20 channels per group");
        }

        const channelId = await ctx.db.insert("channels", {
            groupId: args.groupId,
            name: args.name,
            type: "custom",
            purpose: args.purpose,
            isManagerOnlyPost: args.isManagerOnlyPost ?? false,
            createdBy: user._id,
            createdAt: Date.now(),
        });

        return channelId;
    },
});

// Helper for default channels
export async function createDefaultChannels(ctx: any, groupId: any, createdBy: string = "system") {
    const defaults = [
        { name: "Announcements", purpose: "Official updates", isManagerOnlyPost: true },
        { name: "General", purpose: "Casual conversation", isManagerOnlyPost: false },
        { name: "Planning", purpose: "Event coordination", isManagerOnlyPost: false },
        { name: "Feedback", purpose: "Suggestions and polls", isManagerOnlyPost: false },
    ];

    for (const c of defaults) {
        await ctx.db.insert("channels", {
            groupId,
            name: c.name,
            type: "default",
            purpose: c.purpose,
            isManagerOnlyPost: c.isManagerOnlyPost,
            createdBy,
            createdAt: Date.now(),
        });
    }
}

export const updateChannel = mutation({
    args: {
        channelId: v.id("channels"),
        name: v.optional(v.string()),
        purpose: v.optional(v.string()),
        isManagerOnlyPost: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const channel = await ctx.db.get(args.channelId);
        if (!channel) throw new Error("Channel not found");

        if (channel.type === "default") {
            throw new Error("Cannot edit default channels");
        }

        // Check manager role
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", channel.groupId).eq("userId", user._id))
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can edit channels");
        }

        await ctx.db.patch(args.channelId, {
            name: args.name ?? channel.name,
            purpose: args.purpose ?? channel.purpose,
            isManagerOnlyPost: args.isManagerOnlyPost ?? channel.isManagerOnlyPost,
        });
    },
});

export const deleteChannel = mutation({
    args: {
        channelId: v.id("channels"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const channel = await ctx.db.get(args.channelId);
        if (!channel) throw new Error("Channel not found");

        if (channel.type === "default") {
            throw new Error("Cannot delete default channels");
        }

        // Check manager role
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", channel.groupId).eq("userId", user._id))
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can delete channels");
        }

        await ctx.db.delete(args.channelId);
    },
});

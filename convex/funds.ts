import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

async function getAuthUserSafe(ctx: any) {
    try {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) console.log("[Auth] No user found in session");
        return user;
    } catch (e: any) {
        console.error("[Auth] getAuthUser error:", e.message);
        return null;
    }
}

// ─── Community Funds ────────────────────────────────────────────────

export const createFund = mutation({
    args: {
        groupId: v.id("groups"),
        title: v.string(),
        description: v.string(),
        targetAmount: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", user._id))
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can create funding goals");
        }

        return await ctx.db.insert("groupFunds", {
            groupId: args.groupId,
            title: args.title,
            description: args.description,
            targetAmount: args.targetAmount,
            currentAmount: 0,
            createdBy: user._id,
            isActive: true,
            createdAt: Date.now(),
        });
    },
});

export const getGroupFunds = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("groupFunds")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
    },
});

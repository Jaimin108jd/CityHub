import { v } from "convex/values";
// Refreshing to ensure visibility
import { internalMutation } from "./_generated/server";

export const recordEventPayment = internalMutation({
    args: {
        eventId: v.id("events"),
        userId: v.string(),
        paymentId: v.string(),
        orderId: v.string(),
        signature: v.string(),
        amount: v.number(),
    },
    handler: async (ctx, args) => {
        // Prevent duplicate - check if orderId exists
        const existing = await ctx.db
            .query("eventPayments")
            .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
            .filter((q) => q.eq(q.field("orderId"), args.orderId))
            .first();

        if (existing) return; // Already recorded

        await ctx.db.insert("eventPayments", {
            eventId: args.eventId,
            userId: args.userId,
            paymentId: args.paymentId,
            orderId: args.orderId,
            signature: args.signature,
            amount: args.amount,
            status: "paid",
            createdAt: Date.now(),
        });

        // Add user to event listeners
        const event = await ctx.db.get(args.eventId);
        if (event && !event.attendees.includes(args.userId)) {
            await ctx.db.patch(args.eventId, {
                attendees: [...event.attendees, args.userId],
            });
        }

        // 🔴 Send payment success notification (Critical)
        if (event) {
            const group = await ctx.db.get(event.groupId);
            await ctx.db.insert("notifications", {
                userId: args.userId,
                type: "payment_success",
                layer: "critical",
                title: "Payment Confirmed",
                message: `Payment of ₹${args.amount} confirmed for "${event.title}"`,
                icon: "payment",
                data: { eventId: args.eventId, groupId: event.groupId, amount: args.amount },
                groupId: event.groupId,
                isRead: false,
                createdAt: Date.now(),
            });
        }
    },
});

export const recordFundContribution = internalMutation({
    args: {
        fundId: v.id("groupFunds"),
        userId: v.string(),
        paymentId: v.string(),
        orderId: v.string(),
        signature: v.string(),
        amount: v.number(),
    },
    handler: async (ctx, args) => {
        // Check duplicate
        const existing = await ctx.db
            .query("fundContributions")
            .withIndex("by_fund", (q) => q.eq("fundId", args.fundId))
            .filter((q) => q.eq(q.field("orderId"), args.orderId))
            .first();

        if (existing) return;

        await ctx.db.insert("fundContributions", {
            fundId: args.fundId,
            userId: args.userId,
            paymentId: args.paymentId,
            orderId: args.orderId,
            signature: args.signature,
            amount: args.amount,
            createdAt: Date.now(),
        });

        const fund = await ctx.db.get(args.fundId);
        if (fund) {
            const newAmount = (fund.currentAmount || 0) + args.amount;
            await ctx.db.patch(args.fundId, {
                currentAmount: newAmount,
            });

            // 🟡 Notify if fund goal reached (Important)
            if (newAmount >= fund.targetAmount && fund.currentAmount < fund.targetAmount) {
                const group = await ctx.db.get(fund.groupId);
                const members = await ctx.db
                    .query("groupMembers")
                    .withIndex("by_group", (q) => q.eq("groupId", fund.groupId))
                    .collect();
                for (const m of members) {
                    await ctx.db.insert("notifications", {
                        userId: m.userId,
                        type: "fund_goal",
                        layer: "important",
                        title: "Fund Goal Reached! 🎉",
                        message: `"${fund.title}" reached its goal of ₹${fund.targetAmount}`,
                        icon: "payment",
                        data: { fundId: args.fundId, groupId: fund.groupId },
                        groupId: fund.groupId,
                        isRead: false,
                        createdAt: Date.now(),
                    });
                }
            }

            // 🔴 Payment confirmation for contributor
            await ctx.db.insert("notifications", {
                userId: args.userId,
                type: "payment_success",
                layer: "critical",
                title: "Contribution Confirmed",
                message: `Your ₹${args.amount} contribution to "${fund.title}" was received`,
                icon: "payment",
                data: { fundId: args.fundId, groupId: fund.groupId, amount: args.amount },
                groupId: fund.groupId,
                isRead: false,
                createdAt: Date.now(),
            });
        }
    },
});

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";

// ─── Notification Layer Definitions ─────────────────────────────────
// 🔴 Critical  — realtime + web push notification
// 🟡 Important — realtime in-app only
// ⚪ Passive   — tray only, no push

export const NOTIFICATION_CONFIG = {
    // Critical: realtime + web notification
    join_request: { layer: "critical", icon: "governance", title: "Join Request" },
    join_result: { layer: "critical", icon: "governance", title: "Request Update" },
    mention: { layer: "critical", icon: "message", title: "You were mentioned" },
    payment_success: { layer: "critical", icon: "payment", title: "Payment Confirmed" },

    // Important: realtime in-app only
    new_message: { layer: "important", icon: "message", title: "New Message" },
    poll_created: { layer: "important", icon: "vote", title: "New Poll" },
    governance_alert: { layer: "important", icon: "governance", title: "Governance Alert" },
    fund_goal: { layer: "important", icon: "payment", title: "Fund Goal Reached" },

    // Passive: tray only
    member_joined: { layer: "passive", icon: "member", title: "Member Joined" },
    member_left: { layer: "passive", icon: "member", title: "Member Left" },
    event_created: { layer: "passive", icon: "event", title: "New Event" },
    photo_uploaded: { layer: "passive", icon: "photo", title: "Photo Uploaded" },
    reaction: { layer: "passive", icon: "message", title: "New Reaction" },
    moderation_flag: { layer: "important", icon: "governance", title: "Content Flagged" },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_CONFIG;

// ─── Auth Helper ────────────────────────────────────────────────────
async function getAuthUserSafe(ctx: any) {
    try {
        return await authComponent.getAuthUser(ctx);
    } catch {
        return null;
    }
}

// ─── Internal: Create Notification (used by other modules) ──────────
export const createNotification = internalMutation({
    args: {
        userId: v.string(),
        type: v.string(),
        message: v.string(),
        data: v.optional(v.any()),
        groupId: v.optional(v.id("groups")),
    },
    handler: async (ctx, args) => {
        const config = NOTIFICATION_CONFIG[args.type as NotificationType] ?? {
            layer: "passive",
            icon: "message",
            title: "Notification",
        };

        // Check user notification preferences
        const prefs = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        // Check if group is muted
        if (prefs && args.groupId && prefs.mutedGroupIds?.includes(args.groupId)) {
            // Still store passive notifications, skip critical/important
            if (config.layer !== "passive") return null;
        }

        // Check quiet hours for critical notifications
        if (prefs?.quietHoursEnabled && config.layer === "critical") {
            const now = new Date();
            const hour = now.getHours();
            const start = prefs.quietHoursStart ?? 22;
            const end = prefs.quietHoursEnd ?? 7;

            const isQuiet = start > end
                ? hour >= start || hour < end  // e.g., 22:00 to 07:00
                : hour >= start && hour < end; // e.g., 01:00 to 06:00

            if (isQuiet) {
                // Downgrade to important (in-app only, no web push)
                await ctx.db.insert("notifications", {
                    userId: args.userId,
                    type: args.type,
                    layer: "important",
                    title: config.title,
                    message: args.message,
                    icon: config.icon,
                    data: args.data,
                    groupId: args.groupId,
                    isRead: false,
                    createdAt: Date.now(),
                });
                return null; // Signal no web push needed
            }
        }

        const notifId = await ctx.db.insert("notifications", {
            userId: args.userId,
            type: args.type,
            layer: config.layer,
            title: config.title,
            message: args.message,
            icon: config.icon,
            data: args.data,
            groupId: args.groupId,
            isRead: false,
            createdAt: Date.now(),
        });

        return notifId;
    },
});

// ─── Query: Get Notifications (Realtime) ────────────────────────────
export const getNotifications = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        const limit = args.limit ?? 50;

        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(limit);

        // Enrich with group name
        const enriched = await Promise.all(
            notifications.map(async (n) => {
                let groupName: string | null = null;
                if (n.groupId) {
                    const group = await ctx.db.get(n.groupId);
                    groupName = group?.name ?? null;
                }
                return { ...n, groupName };
            })
        );

        return enriched;
    },
});

// ─── Query: Get Unread Count ────────────────────────────────────────
export const getUnreadCount = query({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return 0;

        const unread = await ctx.db
            .query("notifications")
            .withIndex("by_user_read", (q) =>
                q.eq("userId", user._id).eq("isRead", false)
            )
            .collect();

        return unread.length;
    },
});

// ─── Query: Recent Critical Notifications (for web push watcher) ───
export const getRecentCritical = query({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        // Only fetch the last 10 unread critical notifications
        const recent = await ctx.db
            .query("notifications")
            .withIndex("by_user_read", (q) =>
                q.eq("userId", user._id).eq("isRead", false)
            )
            .order("desc")
            .take(10);

        return recent
            .filter((n) => n.layer === "critical")
            .map((n) => ({
                _id: n._id,
                title: n.title ?? "Notification",
                message: n.message,
                data: n.data,
                createdAt: n.createdAt,
            }));
    },
});

// ─── Mutation: Mark as Read ─────────────────────────────────────────
export const markAsRead = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const notification = await ctx.db.get(args.notificationId);
        if (!notification || notification.userId !== user._id) return;

        await ctx.db.patch(args.notificationId, { isRead: true });
    },
});

// ─── Mutation: Mark All as Read ─────────────────────────────────────
export const markAllAsRead = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const unread = await ctx.db
            .query("notifications")
            .withIndex("by_user_read", (q) =>
                q.eq("userId", user._id).eq("isRead", false)
            )
            .collect();

        for (const n of unread) {
            await ctx.db.patch(n._id, { isRead: true });
        }
    },
});

// ─── Mutation: Delete Old Notifications (cleanup) ───────────────────
export const deleteOldNotifications = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const old = await ctx.db
            .query("notifications")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .filter((q) => q.lt(q.field("createdAt"), thirtyDaysAgo))
            .collect();

        for (const n of old) {
            await ctx.db.delete(n._id);
        }
    },
});

// ─── Notification Preferences ───────────────────────────────────────

export const getPreferences = query({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        return await ctx.db
            .query("notificationPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();
    },
});

export const updatePreferences = mutation({
    args: {
        webNotificationsEnabled: v.optional(v.boolean()),
        quietHoursEnabled: v.optional(v.boolean()),
        quietHoursStart: v.optional(v.number()),
        quietHoursEnd: v.optional(v.number()),
        mutedGroupIds: v.optional(v.array(v.id("groups"))),
        mutedChannelIds: v.optional(v.array(v.id("channels"))),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const existing = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (existing) {
            const updates: Record<string, any> = {};
            for (const [key, value] of Object.entries(args)) {
                if (value !== undefined) updates[key] = value;
            }
            await ctx.db.patch(existing._id, updates);
        } else {
            await ctx.db.insert("notificationPreferences", {
                userId: user._id,
                webNotificationsEnabled: args.webNotificationsEnabled ?? false,
                quietHoursEnabled: args.quietHoursEnabled ?? false,
                quietHoursStart: args.quietHoursStart,
                quietHoursEnd: args.quietHoursEnd,
                mutedGroupIds: args.mutedGroupIds,
                mutedChannelIds: args.mutedChannelIds,
            });
        }
    },
});

export const toggleMuteGroup = mutation({
    args: {
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const prefs = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (!prefs) {
            await ctx.db.insert("notificationPreferences", {
                userId: user._id,
                webNotificationsEnabled: false,
                quietHoursEnabled: false,
                mutedGroupIds: [args.groupId],
                mutedChannelIds: [],
            });
            return true; // now muted
        }

        const muted = prefs.mutedGroupIds ?? [];
        const isMuted = muted.includes(args.groupId);

        await ctx.db.patch(prefs._id, {
            mutedGroupIds: isMuted
                ? muted.filter((id) => id !== args.groupId)
                : [...muted, args.groupId],
        });

        return !isMuted; // returns new mute state
    },
});

export const toggleMuteChannel = mutation({
    args: {
        channelId: v.id("channels"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const prefs = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (!prefs) {
            await ctx.db.insert("notificationPreferences", {
                userId: user._id,
                webNotificationsEnabled: false,
                quietHoursEnabled: false,
                mutedGroupIds: [],
                mutedChannelIds: [args.channelId],
            });
            return true;
        }

        const muted = prefs.mutedChannelIds ?? [];
        const isMuted = muted.includes(args.channelId);

        await ctx.db.patch(prefs._id, {
            mutedChannelIds: isMuted
                ? muted.filter((id) => id !== args.channelId)
                : [...muted, args.channelId],
        });

        return !isMuted;
    },
});

// ─── Push Subscriptions (for Web Notifications) ─────────────────────

export const savePushSubscription = mutation({
    args: {
        endpoint: v.string(),
        p256dh: v.string(),
        auth: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Check if already exists
        const existing = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
            .first();

        if (existing) {
            // Update if same user, delete if different
            if (existing.userId === user._id) return;
            await ctx.db.delete(existing._id);
        }

        await ctx.db.insert("pushSubscriptions", {
            userId: user._id,
            endpoint: args.endpoint,
            p256dh: args.p256dh,
            auth: args.auth,
            createdAt: Date.now(),
        });
    },
});

export const removePushSubscription = mutation({
    args: {
        endpoint: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const sub = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
            .first();

        if (sub && sub.userId === user._id) {
            await ctx.db.delete(sub._id);
        }
    },
});

// ─── Get Push Subscriptions for User (internal use) ─────────────────
export const getPushSubscriptions = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
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

// ─── Create Event ───────────────────────────────────────────────────
export const createEvent = mutation({
    args: {
        groupId: v.id("groups"),
        title: v.string(),
        description: v.string(),
        startTime: v.number(),
        endTime: v.optional(v.number()),
        location: v.string(),
        locationCoords: v.optional(v.object({ lat: v.number(), lon: v.number() })),
        eventType: v.union(v.literal("online"), v.literal("in-person")),
        isPaid: v.optional(v.boolean()),
        price: v.optional(v.number()),
        capacity: v.optional(v.number()),
        refundPolicy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", user._id))
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can create events");
        }

        // Get group category to tag event
        const group = await ctx.db.get(args.groupId);
        const category = group?.category;

        const eventId = await ctx.db.insert("events", {
            ...args,
            category,
            attendees: [user._id],
            status: "upcoming",
            createdBy: user._id,
            photoIds: [],
        });

        // ⚪ Notify group members about new event (Passive)
        if (group) {
            const members = await ctx.db
                .query("groupMembers")
                .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
                .collect();
            const profile = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", user._id)).first();
            const creatorName = profile?.name ?? "A manager";
            for (const m of members) {
                if (m.userId !== user._id) {
                    await ctx.db.insert("notifications", {
                        userId: m.userId,
                        type: "event_created",
                        layer: "passive",
                        title: "New Event",
                        message: `${creatorName} created "${args.title}" in ${group.name}`,
                        icon: "event",
                        data: { groupId: args.groupId, eventId },
                        groupId: args.groupId,
                        isRead: false,
                        createdAt: Date.now(),
                    });
                }
            }
        }

        // Schedule semantic search embedding indexing
        await ctx.scheduler.runAfter(0, internal.ai.indexEventEmbedding, { eventId });

        return eventId;
    },
});

// ─── Attend / RSVP Event ────────────────────────────────────────────
export const attendEvent = mutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found");

        // Block attendance for completed/cancelled events
        const now = Date.now();
        const computedStatus = event.status === "cancelled" ? "cancelled"
            : event.status === "completed" ? "completed"
                : event.endTime && now > event.endTime ? "completed"
                    : event.startTime <= now ? "ongoing"
                        : "upcoming";
        if (computedStatus === "completed" || computedStatus === "cancelled") {
            throw new Error("Cannot attend a " + computedStatus + " event");
        }

        if (event.attendees.includes(user._id)) return;

        if (event.isPaid) {
            throw new Error("This is a paid event. Please purchase a ticket first.");
        }

        if (event.capacity && event.attendees.length >= event.capacity) {
            throw new Error("Event is at full capacity");
        }

        await ctx.db.patch(args.eventId, {
            attendees: [...event.attendees, user._id],
        });
    },
});

// ─── Cancel Attendance ──────────────────────────────────────────────
export const cancelAttendance = mutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found");

        // Block for completed/cancelled events
        if (event.status === "completed" || event.status === "cancelled") {
            throw new Error("Cannot cancel attendance for a " + event.status + " event");
        }

        // Block cancellation for paid events (ticket purchases are non-refundable via self-service)
        if (event.isPaid) {
            throw new Error("Paid event tickets cannot be cancelled. Please contact the event organiser for a refund.");
        }

        await ctx.db.patch(args.eventId, {
            attendees: event.attendees.filter((id) => id !== user._id),
        });
    },
});

// ─── Update Event Status ────────────────────────────────────────────
export const updateEventStatus = mutation({
    args: {
        eventId: v.id("events"),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found");

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can update event status");
        }

        // Validate status transitions
        const current = event.status;
        if (current === "cancelled") {
            throw new Error("Cannot change status of a cancelled event");
        }
        if (current === "completed" && args.status !== "completed") {
            throw new Error("Cannot change status of a completed event");
        }
        if (args.status === "cancelled" && current === "completed") {
            throw new Error("Cannot cancel an already completed event");
        }

        await ctx.db.patch(args.eventId, { status: args.status });
    },
});

// ─── Upload Event Cover Image (Manager Only) ───────────────────────
export const uploadEventCoverImage = mutation({
    args: {
        eventId: v.id("events"),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found");

        // Manager/founder only
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can upload a cover image");
        }

        if (event.status === "cancelled") {
            throw new Error("Cannot modify a cancelled event");
        }

        await ctx.db.patch(args.eventId, { coverImageId: args.storageId });
    },
});

// ─── Upload Event Photo ─────────────────────────────────────────────
export const uploadEventPhoto = mutation({
    args: {
        eventId: v.id("events"),
        storageId: v.id("_storage"),
        caption: v.optional(v.string()),
        type: v.optional(v.string()), // "memory" | "live" | "promo"
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found");

        const now = Date.now();
        const endTime = event.endTime || event.startTime;
        const computedStatus = event.status === "cancelled" ? "cancelled"
            : event.status === "completed" || now > endTime ? "completed"
                : event.startTime <= now ? "ongoing"
                    : "upcoming";

        if (computedStatus === "cancelled") {
            throw new Error("Cannot upload photos to a cancelled event");
        }

        // Check membership
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
            .first();
        if (!membership) throw new Error("Only group members can upload photos");

        const isManagerOrFounder = membership.role === "manager" || membership.role === "founder";
        const isAttendee = event.attendees.includes(user._id);

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        let photoType: string = args.type || "memory";
        let needsApproval = false;

        if (computedStatus === "upcoming") {
            // UPCOMING: Only managers can upload promo media
            if (!isManagerOrFounder) {
                throw new Error("Only managers can upload promo media for upcoming events");
            }
            photoType = "promo";
        } else if (computedStatus === "ongoing") {
            // ONGOING: Attendees can upload live photos
            if (!isAttendee) {
                throw new Error("Only event attendees can upload live photos");
            }
            photoType = "live";
        } else if (computedStatus === "completed") {
            // COMPLETED: Attendees can upload memory photos
            if (!isAttendee && !isManagerOrFounder) {
                throw new Error("Only event attendees can upload memory photos");
            }

            // Within 7-day window: auto-approved
            // After 7-day window: needs manager approval
            if (now > endTime + SEVEN_DAYS) {
                if (!isManagerOrFounder) {
                    needsApproval = true;
                }
            }
            photoType = "memory";
        }

        // Insert the photo record
        await ctx.db.insert("eventPhotos", {
            eventId: args.eventId,
            storageId: args.storageId,
            uploadedBy: user._id,
            caption: args.caption,
            type: photoType,
            needsApproval,
            approved: needsApproval ? false : true,
            createdAt: now,
        });

        // Also append to event's photoIds array (only if auto-approved)
        if (!needsApproval) {
            const currentPhotos = event.photoIds || [];
            await ctx.db.patch(args.eventId, {
                photoIds: [...currentPhotos, args.storageId],
            });
        }
    },
});

// ─── Approve Event Photo (Manager Only) ─────────────────────────────
export const approveEventPhoto = mutation({
    args: {
        photoId: v.id("eventPhotos"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const photo = await ctx.db.get(args.photoId);
        if (!photo) throw new Error("Photo not found");

        const event = await ctx.db.get(photo.eventId);
        if (!event) throw new Error("Event not found");

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can approve photos");
        }

        await ctx.db.patch(args.photoId, { approved: true, needsApproval: false });

        // Add to event's photoIds
        const currentPhotos = event.photoIds || [];
        if (!currentPhotos.includes(photo.storageId)) {
            await ctx.db.patch(event._id, {
                photoIds: [...currentPhotos, photo.storageId],
            });
        }
    },
});

// ─── Reject Event Photo (Manager Only) ──────────────────────────────
export const rejectEventPhoto = mutation({
    args: {
        photoId: v.id("eventPhotos"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const photo = await ctx.db.get(args.photoId);
        if (!photo) throw new Error("Photo not found");

        const event = await ctx.db.get(photo.eventId);
        if (!event) throw new Error("Event not found");

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can reject photos");
        }

        // Delete the photo record and storage
        await ctx.storage.delete(photo.storageId);
        await ctx.db.delete(args.photoId);
    },
});

// ─── Get Event Details with Full Data ───────────────────────────────
export const getEventDetails = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) return null;

        const group = await ctx.db.get(event.groupId);

        // Fetch attendees with user info
        const attendeesWithInfo = await Promise.all(
            event.attendees.map(async (userId) => {
                const user = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", userId))
                    .first();
                return user
                    ? { userId, name: user.name, imageUrl: user.imageUrl }
                    : { userId, name: "Unknown", imageUrl: undefined };
            })
        );

        // Fetch photos
        const photos = await ctx.db
            .query("eventPhotos")
            .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
            .collect();

        const photosWithUrls = await Promise.all(
            photos.map(async (photo) => {
                const url = await ctx.storage.getUrl(photo.storageId);
                const uploader = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", photo.uploadedBy))
                    .first();
                return {
                    ...photo,
                    url,
                    uploaderName: uploader?.name || "Unknown",
                };
            })
        );

        // Payment analytics (if paid event)
        let paymentData = null;
        if (event.isPaid) {
            const payments = await ctx.db
                .query("eventPayments")
                .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
                .collect();
            const paidPayments = payments.filter((p) => p.status === "paid");
            paymentData = {
                totalRevenue: paidPayments.reduce((sum, p) => sum + p.amount, 0),
                ticketsSold: paidPayments.length,
                pending: payments.filter((p) => p.status === "created").length,
            };
        }

        return {
            ...event,
            groupName: group?.name || "Unknown Group",
            groupCategory: group?.category || "Other",
            groupCity: group?.city,
            attendeesWithInfo,
            photos: photosWithUrls,
            paymentData,
            attendeeCount: event.attendees.length,
        };
    },
});

// ─── Get Single Event by ID (Public) ────────────────────────────────
export const getEventById = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) return null;

        const group = await ctx.db.get(event.groupId);
        if (!group) return null;

        const now = Date.now();
        const endTime = event.endTime || event.startTime;
        const computedStatus = event.status === "cancelled" ? "cancelled"
            : event.status === "completed" || now > endTime ? "completed"
                : event.startTime <= now ? "ongoing"
                    : "upcoming";

        const coverImageUrl = event.coverImageId ? await ctx.storage.getUrl(event.coverImageId) : null;

        // Check if event city differs from group's base city
        const isTravelEvent = event.locationCoords && group.city
            ? (Math.abs(event.locationCoords.lat - group.city.lat) > 0.5 || Math.abs(event.locationCoords.lon - group.city.lon) > 0.5)
            : false;

        // Get user details for attendees (limited to first 20)
        const attendeeDetails = await Promise.all(
            event.attendees.slice(0, 20).map(async (userId) => {
                const u = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", userId)).first();
                return {
                    userId,
                    name: u?.name || "Unknown",
                    imageUrl: u?.imageUrl,
                    city: u?.city?.name,
                };
            })
        );

        return {
            ...event,
            computedStatus,
            coverImageUrl,
            isTravelEvent,
            groupName: group.name,
            groupCategory: group.category,
            groupCity: group.city,
            attendeeDetails,
        };
    },
});

// ─── Get Event Attendees Analytics (Manager Only) ───────────────────
export const getEventAnalytics = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        const event = await ctx.db.get(args.eventId);
        if (!event) return null;

        // Verify manager
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) return null;

        // Attendee details
        const attendees = await Promise.all(
            event.attendees.map(async (userId) => {
                const u = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", userId)).first();
                return {
                    userId,
                    name: u?.name || "Unknown",
                    imageUrl: u?.imageUrl,
                    city: u?.city?.name,
                };
            })
        );

        // Payment data
        let payments: any[] = [];
        if (event.isPaid) {
            payments = await ctx.db
                .query("eventPayments")
                .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
                .collect();
        }

        const isPast = event.startTime < Date.now();
        const fillRate = event.capacity ? Math.round((event.attendees.length / event.capacity) * 100) : null;

        return {
            event,
            attendees,
            attendeeCount: event.attendees.length,
            capacity: event.capacity || null,
            fillRate,
            isPast,
            revenue: payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
            ticketsSold: payments.filter((p) => p.status === "paid").length,
            pendingPayments: payments.filter((p) => p.status === "created").length,
        };
    },
});

// ─── Get ALL Events for City Map ─────────────────────────────────────
export const getAllEventsForMap = query({
    args: {
        filterStatus: v.optional(v.string()), // "upcoming" | "past" | "all"
        filterCategory: v.optional(v.string()),
        filterGroupId: v.optional(v.id("groups")),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        let events = await ctx.db
            .query("events")
            .collect();

        const now = Date.now();

        // Status filter
        if (args.filterStatus === "upcoming") {
            events = events.filter((e) => e.startTime > now);
        } else if (args.filterStatus === "past") {
            events = events.filter((e) => e.startTime <= now);
        }

        // Group filter
        if (args.filterGroupId) {
            events = events.filter((e) => e.groupId === args.filterGroupId);
        }

        // Date range filter
        if (args.startDate) {
            events = events.filter((e) => e.startTime >= args.startDate!);
        }
        if (args.endDate) {
            events = events.filter((e) => e.startTime <= args.endDate!);
        }

        // Enrich with group info + photos count
        let enriched = await Promise.all(
            events.map(async (event) => {
                const group = await ctx.db.get(event.groupId);
                const photos = await ctx.db
                    .query("eventPhotos")
                    .withIndex("by_event", (q) => q.eq("eventId", event._id))
                    .collect();

                // Get photo URLs (limit to first 4 for map preview)
                const photoUrls = await Promise.all(
                    photos.slice(0, 4).map(async (p) => {
                        const url = await ctx.storage.getUrl(p.storageId);
                        return url;
                    })
                );

                // Use group city coords as fallback if event doesn't have coords
                const coords = event.locationCoords || (group?.city ? { lat: group.city.lat, lon: group.city.lon } : null);

                // Check if event location is far from group's base city
                const isTravelEvent = coords && group?.city
                    ? (Math.abs(coords.lat - group.city.lat) > 0.5 || Math.abs(coords.lon - group.city.lon) > 0.5)
                    : false;

                return {
                    _id: event._id,
                    title: event.title,
                    description: event.description,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    location: event.location,
                    locationCoords: coords,
                    eventType: event.eventType,
                    category: event.category || group?.category || "Other",
                    attendeeCount: event.attendees.length,
                    capacity: event.capacity,
                    isPaid: event.isPaid,
                    price: event.price,
                    status: event.status === "cancelled" ? "cancelled"
                        : event.status === "completed" ? "completed"
                            : (event.endTime || event.startTime) < now ? "completed"
                                : event.startTime <= now ? "ongoing"
                                    : "upcoming",
                    groupId: event.groupId,
                    groupName: group?.name || "Unknown",
                    groupCategory: group?.category || "Other",
                    groupCity: group?.city?.name || null,
                    isTravelEvent,
                    photoUrls: photoUrls.filter(Boolean) as string[],
                    photoCount: photos.length,
                    isPast: event.status === "completed" || event.status === "cancelled" || (event.endTime || event.startTime) <= now,
                };
            })
        );

        // Category filter (applied after enrichment to use resolved category)
        if (args.filterCategory) {
            enriched = enriched.filter((e) => e.category === args.filterCategory);
        }

        // Sort: upcoming first, then by date
        enriched.sort((a, b) => {
            if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
            return a.startTime - b.startTime;
        });

        return enriched;
    },
});

// ─── Get Event Photos ───────────────────────────────────────────────
export const getEventPhotos = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);

        const event = await ctx.db.get(args.eventId);
        if (!event) return [];

        // Check if current user is manager/founder
        let isManagerOrFounder = false;
        if (user) {
            const membership = await ctx.db
                .query("groupMembers")
                .withIndex("by_group_user", (q) => q.eq("groupId", event.groupId).eq("userId", user._id))
                .first();
            isManagerOrFounder = !!membership && (membership.role === "manager" || membership.role === "founder");
        }

        const photos = await ctx.db
            .query("eventPhotos")
            .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
            .collect();

        // Filter: non-managers only see approved photos
        const visiblePhotos = isManagerOrFounder
            ? photos
            : photos.filter((p) => p.approved !== false);

        return Promise.all(
            visiblePhotos.map(async (photo) => {
                const url = await ctx.storage.getUrl(photo.storageId);
                const user = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", photo.uploadedBy))
                    .first();
                return {
                    ...photo,
                    url,
                    uploaderName: user?.name || "Unknown",
                    uploaderImage: user?.imageUrl,
                };
            })
        );
    },
});

// ─── Generate Upload URL (for event photos) ─────────────────────────
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");
        return await ctx.storage.generateUploadUrl();
    },
});



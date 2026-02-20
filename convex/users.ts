import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

/** Safe wrapper — returns null instead of throwing when unauthenticated */
async function getAuthUserSafe(ctx: any) {
    try {
        return await authComponent.getAuthUser(ctx);
    } catch {
        return null;
    }
}

export const createProfile = mutation({
    args: {
        name: v.optional(v.string()),
        city: v.object({
            name: v.string(),
            address: v.optional(v.string()),
            country: v.string(),
            state: v.optional(v.string()),
            lat: v.number(),
            lon: v.number(),
        }),
        bio: v.optional(v.string()),
        interests: v.array(v.string()),
        role: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        isPublic: v.boolean(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) {
            throw new Error("Unauthorized");
        }

        const userId = user._id;

        const existingProfile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (existingProfile) {
            throw new Error("Profile already exists");
        }

        // Pull name from auth user if not explicitly provided
        const profileName = args.name || (user as any).name || "Citizen";

        await ctx.db.insert("users", {
            userId,
            name: profileName,
            city: args.city,
            bio: args.bio,
            interests: args.interests,
            imageUrl: args.imageUrl,
            isPublic: args.isPublic,
        });
    },
});

export const updateProfile = mutation({
    args: {
        name: v.optional(v.string()),
        city: v.optional(
            v.object({
                name: v.string(),
                address: v.optional(v.string()),
                country: v.string(),
                state: v.optional(v.string()),
                lat: v.number(),
                lon: v.number(),
            })
        ),
        bio: v.optional(v.string()),
        interests: v.optional(v.array(v.string())),
        imageUrl: v.optional(v.string()),
        isPublic: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) {
            throw new Error("Unauthorized");
        }

        const userId = user._id;

        const existingProfile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!existingProfile) {
            throw new Error("Profile not found");
        }

        // Update profile in users table
        await ctx.db.patch(existingProfile._id, {
            ...(args.name && { name: args.name }),
            ...(args.city && { city: args.city }),
            ...(args.bio !== undefined && { bio: args.bio }),
            ...(args.interests && { interests: args.interests }),
            ...(args.imageUrl && { imageUrl: args.imageUrl }),
            ...(args.isPublic !== undefined && { isPublic: args.isPublic }),
        });
    },
});

export const getMyProfile = query({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) {
            return null;
        }

        const userId = user._id;

        return await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
    },
});

// ─── Combined sidebar data (profile + groups + avatar in one subscription) ──
export const getSidebarData = query({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        // Profile (lean — only fields the sidebar needs)
        const profile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        // Avatar URL resolved server-side (avoids a separate client query)
        let avatarUrl: string | null = null;
        if (profile?.imageUrl) {
            avatarUrl = await ctx.storage.getUrl(profile.imageUrl as any);
        }

        // Groups — lean: only _id, name, category, role (no coverImage / memberCount)
        const memberships = await ctx.db
            .query("groupMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const groups = (
            await Promise.all(
                memberships.map(async (m) => {
                    const g = await ctx.db.get(m.groupId);
                    if (!g) return null;
                    return { _id: g._id, name: g.name, category: g.category, myRole: m.role };
                })
            )
        ).filter((g) => g !== null);

        return {
            profile: profile ? { city: profile.city, imageUrl: profile.imageUrl } : null,
            avatarUrl,
            userName: (user as any).name || null,
            groups,
        };
    },
});

export const getProfile = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();
    },
});

// ─── Get User Profile with Real Civic Stats ────────────────────────
export const getUserProfileWithStats = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const profile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();
        if (!profile) return null;

        // Check if the viewing user is the profile owner
        const viewer = await getAuthUserSafe(ctx);
        const isOwn = viewer?._id === args.userId;

        // Groups the user is a member of
        const memberships = await ctx.db
            .query("groupMembers")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        const groupIds = memberships.map((m) => m.groupId);
        const groups = await Promise.all(
            groupIds.map(async (gId) => {
                const g = await ctx.db.get(gId);
                if (!g) return null;
                const coverUrl = g.coverImageId ? await ctx.storage.getUrl(g.coverImageId) : null;
                const role = memberships.find((m) => m.groupId === gId)?.role || "member";
                return { _id: g._id, name: g.name, category: g.category, coverUrl, role };
            })
        );

        // Events attended
        const allEvents = await ctx.db.query("events").collect();
        const attendedEvents = allEvents.filter((e) => e.attendees.includes(args.userId));
        const eventsAttended = attendedEvents.length;

        // Votes cast (proposal votes + join request votes)
        const allProposalVotes = await ctx.db.query("proposalVotes").collect();
        const myProposalVotes = allProposalVotes.filter((v) => v.voterId === args.userId);

        const allJoinVotes = await ctx.db.query("votes").collect();
        const myJoinVotes = allJoinVotes.filter((v) => v.voterId === args.userId);

        const votesCast = myProposalVotes.length + myJoinVotes.length;

        // Proposals created
        const allProposals = await ctx.db.query("governanceProposals").collect();
        const myProposals = allProposals.filter((p) => p.proposerId === args.userId);

        // Events created
        const eventsCreated = allEvents.filter((e) => e.createdBy === args.userId).length;

        // Photos uploaded
        const allPhotos = await ctx.db.query("eventPhotos").collect();
        const photosUploaded = allPhotos.filter((p) => p.uploadedBy === args.userId).length;

        // Avatar URL
        const avatarUrl = profile.imageUrl
            ? await ctx.storage.getUrl(profile.imageUrl as any)
            : null;

        // Member since (earliest groupMembers joinedAt or profile creation)
        const earliestJoin = memberships.length > 0
            ? Math.min(...memberships.map((m) => m.joinedAt))
            : profile._creationTime;

        return {
            _id: profile._id,
            userId: profile.userId,
            name: profile.name,
            bio: profile.bio,
            city: profile.city,
            interests: profile.interests,
            imageUrl: profile.imageUrl,
            isPublic: profile.isPublic ?? true,
            avatarUrl,
            isOwn,
            memberSince: earliestJoin,
            stats: {
                groupsJoined: groups.filter(Boolean).length,
                eventsAttended,
                eventsCreated,
                votesCast,
                proposalsMade: myProposals.length,
                photosUploaded,
            },
            groups: groups.filter(Boolean),
        };
    },
});

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) {
            throw new Error("Unauthorized");
        }
        return await ctx.storage.generateUploadUrl();
    },
});

export const getFileUrl = query({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

/** One-time migration: convert old string `city` values to the new object format.
 *  Run once from the Convex dashboard, then delete this mutation. */
export const migrateCityFields = mutation({
    args: {},
    handler: async (ctx) => {
        const allUsers = await ctx.db.query("users").collect();
        let migrated = 0;
        for (const user of allUsers) {
            if (typeof user.city === "string") {
                await ctx.db.patch(user._id, {
                    city: {
                        name: user.city as string,
                        country: "IN", // default — adjust as needed
                    },
                } as any);
                migrated++;
            }
        }
        return { migrated };
    },
});

/** One-time migration: add isPublic field to existing profiles.
 *  Run once from the Convex dashboard, then delete this mutation. */
export const migrateAddIsPublicField = mutation({
    args: {},
    handler: async (ctx) => {
        const allUsers = await ctx.db.query("users").collect();
        let migrated = 0;
        for (const user of allUsers) {
            if (user.isPublic === undefined) {
                await ctx.db.patch(user._id, {
                    isPublic: true, // Default existing profiles to public
                } as any);
                migrated++;
            }
        }
        return { migrated };
    },
});

export const updatePresence = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return;

        const existing = await ctx.db
            .query("userPresence")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
        } else {
            await ctx.db.insert("userPresence", {
                userId: user._id,
                lastSeenAt: Date.now(),
            });
        }
    },
});

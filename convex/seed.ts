import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { createAuth } from "./auth";

// ─── Constants ────────────────────────────────────────────────────────────────
const CITIES = [
    { name: "Gandhinagar", address: "Sector 11 (Info City)", state: "Gujarat", country: "IN", lat: 23.1895, lon: 72.6288 },
    { name: "Gandhinagar", address: "Sector 16", state: "Gujarat", country: "IN", lat: 23.2386, lon: 72.6369 },
    { name: "Gandhinagar", address: "Sector 21", state: "Gujarat", country: "IN", lat: 23.2450, lon: 72.6465 },
    { name: "Gandhinagar", address: "Gift City", state: "Gujarat", country: "IN", lat: 23.1610, lon: 72.6841 },
    { name: "Ahmedabad", address: "Navrangpura", state: "Gujarat", country: "IN", lat: 23.0360, lon: 72.5469 },
    { name: "Ahmedabad", address: "Vastrapur", state: "Gujarat", country: "IN", lat: 23.0371, lon: 72.5269 },
    { name: "Ahmedabad", address: "Bopal", state: "Gujarat", country: "IN", lat: 23.0323, lon: 72.4665 },
    { name: "Ahmedabad", address: "Maninagar", state: "Gujarat", country: "IN", lat: 22.9975, lon: 72.5975 },
    { name: "Mumbai", address: "Bandra West", state: "Maharashtra", country: "IN", lat: 19.0596, lon: 72.8295 },
    { name: "Mumbai", address: "Andheri East", state: "Maharashtra", country: "IN", lat: 19.1136, lon: 72.8697 },
    { name: "Bangalore", address: "Koramangala", state: "Karnataka", country: "IN", lat: 12.9352, lon: 77.6245 },
    { name: "Bangalore", address: "Indiranagar", state: "Karnataka", country: "IN", lat: 12.9784, lon: 77.6408 },
];

const GROUP_NAMES = [
    { name: "Tech Innovators", category: "Technology", tags: ["tech", "startup", "coding"] },
    { name: "Green Earth Society", category: "Environment", tags: ["sustainability", "nature", "green"] },
    { name: "Local Artists Hub", category: "Art", tags: ["art", "painting", "creativity"] },
    { name: "Fitness Fanatics", category: "Health", tags: ["fitness", "workout", "health"] },
    { name: "Bookworms Club", category: "Literature", tags: ["books", "reading", "club"] },
    { name: "Culinary Explorers", category: "Food", tags: ["food", "cooking", "recipes"] },
    { name: "Photography Enthusiasts", category: "Photography", tags: ["photography", "camera", "photos"] },
    { name: "Travel Bugs", category: "Travel", tags: ["travel", "adventure", "explore"] },
    { name: "Music Lovers", category: "Music", tags: ["music", "concerts", "bands"] },
    { name: "Film Fanatics", category: "Film", tags: ["movies", "cinema", "film"] },
    { name: "History Buffs", category: "History", tags: ["history", "museums", "past"] },
    { name: "Science Geeks", category: "Science", tags: ["science", "experiments", "geeks"] },
];

const SEED_USERS = [
    { name: "Aarav Shah", email: "aarav@seed.dev", password: "Seed1234!" },
    { name: "Vivaan Patel", email: "vivaan@seed.dev", password: "Seed1234!" },
    { name: "Aditya Mehta", email: "aditya@seed.dev", password: "Seed1234!" },
    { name: "Vihaan Joshi", email: "vihaan@seed.dev", password: "Seed1234!" },
    { name: "Arjun Desai", email: "arjun@seed.dev", password: "Seed1234!" },
    { name: "Sai Iyer", email: "sai@seed.dev", password: "Seed1234!" },
    { name: "Reyansh Kumar", email: "reyansh@seed.dev", password: "Seed1234!" },
    { name: "Ayaan Khan", email: "ayaan@seed.dev", password: "Seed1234!" },
    { name: "Krishna Nair", email: "krishna@seed.dev", password: "Seed1234!" },
    { name: "Ishaan Rao", email: "ishaan@seed.dev", password: "Seed1234!" },
    { name: "Shaurya Gupta", email: "shaurya@seed.dev", password: "Seed1234!" },
    { name: "Atharv Singh", email: "atharv@seed.dev", password: "Seed1234!" },
    { name: "Ananya Verma", email: "ananya@seed.dev", password: "Seed1234!" },
    { name: "Myra Sharma", email: "myra@seed.dev", password: "Seed1234!" },
    { name: "Aarohi Trivedi", email: "aarohi@seed.dev", password: "Seed1234!" },
    { name: "Zara Malik", email: "zara@seed.dev", password: "Seed1234!" },
    { name: "Pari Chawla", email: "pari@seed.dev", password: "Seed1234!" },
    { name: "Saanvi Reddy", email: "saanvi@seed.dev", password: "Seed1234!" },
];

// ─── Image Fetching ───────────────────────────────────────────────────────────

async function fetchAndStoreImage(
    ctx: any,
    seed: number,
    width = 800,
    height = 600
): Promise<Id<"_storage">> {
    const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Picsum fetch failed [${response.status}]: ${url}`);
    const blob = await response.blob();
    return await ctx.storage.store(blob);
}

// ─── Main Seed Action ─────────────────────────────────────────────────────────

export const run_seed = internalAction({
    args: {},
    handler: async (ctx) => {
        console.log("🌱 Starting Seed Process...");

        // ── 1. Create auth users via createAuth(ctx) ───────────────────────────
        // We pass `ctx` directly — this is exactly how your app creates auth
        // inside mutations/actions, so it bypasses all HTTP/origin checks.
        console.log("🔐 Creating auth users...");
        const authUserIds: string[] = [];
        const auth = createAuth(ctx);

        for (const u of SEED_USERS) {
            try {
                const result = await auth.api.signUpEmail({
                    body: { name: u.name, email: u.email, password: u.password },
                });
                const userId = result?.user?.id;
                if (!userId) throw new Error(`No user ID in response: ${JSON.stringify(result)}`);
                authUserIds.push(userId);
                console.log(`  ✓ Created: ${u.email} → ${userId}`);
            } catch (e: any) {
                // User likely already exists from a previous seed run — sign in to recover ID
                console.warn(`  ⚠ Create failed for ${u.email}: ${e?.message}`);
                try {
                    const signIn = await auth.api.signInEmail({
                        body: { email: u.email, password: u.password },
                    });
                    const userId = signIn?.user?.id;
                    if (!userId) throw new Error("No ID from sign-in either");
                    authUserIds.push(userId);
                    console.log(`  ↩ Re-used existing: ${u.email} → ${userId}`);
                } catch (e2: any) {
                    console.error(`  ✗ Giving up on ${u.email}: ${e2?.message}`);
                    authUserIds.push(""); // keep indexes aligned
                }
            }
        }

        // ── 2. Fetch avatar images (Picsum seeds 1–18) ────────────────────────
        console.log("👤 Fetching user avatars from Picsum...");
        const userStorageIds: (Id<"_storage"> | null)[] = [];

        for (let i = 0; i < SEED_USERS.length; i++) {
            try {
                userStorageIds.push(await fetchAndStoreImage(ctx, i + 1, 400, 400));
            } catch (e) {
                console.error(`  ✗ Avatar ${i} failed:`, e);
                userStorageIds.push(null);
            }
        }

        // ── 3. Fetch group cover images (Picsum seeds 100–111) ────────────────
        console.log("📸 Fetching group cover images from Picsum...");
        const groupStorageIds: (Id<"_storage"> | null)[] = [];

        for (let i = 0; i < GROUP_NAMES.length; i++) {
            try {
                groupStorageIds.push(await fetchAndStoreImage(ctx, 100 + i, 800, 600));
            } catch (e) {
                console.error(`  ✗ Cover ${i} failed:`, e);
                groupStorageIds.push(null);
            }
        }

        // ── 4. Populate database ───────────────────────────────────────────────
        console.log("💾 Writing to database...");
        await ctx.runMutation(internal.seed.populate_database, {
            authUserIds,
            groupStorageIds,
            userStorageIds,
        });

        console.log("✅ Seed Process Complete!");
    },
});

// ─── Database Population Mutation ────────────────────────────────────────────

export const populate_database = internalMutation({
    args: {
        authUserIds: v.array(v.string()),
        groupStorageIds: v.array(v.union(v.id("_storage"), v.null())),
        userStorageIds: v.array(v.union(v.id("_storage"), v.null())),
    },
    handler: async (ctx, args) => {
        console.log("🗑️ Wiping existing database...");

        const tables: Parameters<typeof ctx.db.query>[0][] = [
            "users", "groups", "groupMembers", "events", "eventPhotos",
            "groupInvites", "joinRequests", "votes", "notifications",
            "notificationPreferences", "pushSubscriptions", "governanceLogs",
            "governanceProposals", "proposalVotes", "channels", "messages", "channelSubscriptions",
            "polls", "pollVotes", "typingIndicators", "presence", "userPresence",
            "eventPayments", "groupFunds", "fundContributions", "groupEmbeddings",
            "eventEmbeddings", "moderationFlags", "moderationWarnings", "userTimeouts",
        ];

        for (const table of tables) {
            const records = await ctx.db.query(table).collect();
            for (const record of records) {
                await ctx.db.delete(record._id);
            }
        }
        console.log("✅ Database wiped.");

        // ── Insert users ──────────────────────────────────────────────────────
        const userIds: Id<"users">[] = [];

        for (let i = 0; i < SEED_USERS.length; i++) {
            const authId = args.authUserIds[i];
            if (!authId) {
                console.warn(`  Skipping user ${i} — no auth ID.`);
                continue;
            }

            const dbUserId = await ctx.db.insert("users", {
                userId: authId,
                name: SEED_USERS[i].name,
                bio: "Passionate about building community.",
                city: CITIES[i % CITIES.length],
                interests: ["Technology", "Community", "Art"],
                imageUrl: args.userStorageIds[i] ?? undefined,
                isPublic: true,
            });

            userIds.push(dbUserId);
        }

        console.log(`  ✓ Inserted ${userIds.length} users.`);

        // ── Insert groups + memberships ───────────────────────────────────────
        for (let i = 0; i < GROUP_NAMES.length; i++) {
            if (i >= userIds.length) break;

            const config = GROUP_NAMES[i];
            const city = CITIES[i];
            const founderConvexId = userIds[i];
            const founderProfile = await ctx.db.get(founderConvexId);
            if (!founderProfile) continue;

            const groupId = await ctx.db.insert("groups", {
                name: config.name,
                description: `A wonderful community in ${city.name} focused on ${config.category}. We welcome all enthusiasts from the local area and beyond.`,
                category: config.category,
                tags: config.tags,
                city,
                isPublic: true,
                coverImageId: args.groupStorageIds[i] ?? undefined,
                createdBy: founderProfile.userId,
                transparencyMode: "public_all",
                foundersOnlyRules: false,
            });

            await ctx.db.insert("groupMembers", {
                groupId,
                userId: founderProfile.userId,
                role: "founder",
                joinedAt: Date.now(),
            });

            const others = userIds
                .filter(id => id !== founderConvexId)
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.floor(Math.random() * 2) + 4);

            for (let j = 0; j < others.length; j++) {
                const memberProfile = await ctx.db.get(others[j]);
                if (!memberProfile) continue;
                await ctx.db.insert("groupMembers", {
                    groupId,
                    userId: memberProfile.userId,
                    role: j === 0 ? "manager" : "member",
                    joinedAt: Date.now(),
                });
            }
        }

        console.log(`  ✓ Inserted ${GROUP_NAMES.length} groups with memberships.`);
    },
});
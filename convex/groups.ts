import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { createDefaultChannels } from "./channels";

/** Safe wrapper — returns null instead of throwing when unauthenticated */
async function getAuthUserSafe(ctx: any) {
    try {
        return await authComponent.getAuthUser(ctx);
    } catch {
        return null;
    }
}

// ─── Group Categories ───────────────────────────────────────────────
export const GROUP_CATEGORIES = [
    "Neighborhood",
    "Environment",
    "Education",
    "Arts & Culture",
    "Sports & Recreation",
    "Safety & Watch",
    "Local Business",
    "Tech & Innovation",
    "Health & Wellness",
    "Other",
] as const;

// ─── Mutations ──────────────────────────────────────────────────────

export const createGroup = mutation({
    args: {
        name: v.string(),
        description: v.string(),
        category: v.string(),
        tags: v.array(v.string()),
        city: v.object({
            name: v.string(),
            country: v.string(),
            state: v.optional(v.string()),
            lat: v.number(),
            lon: v.number(),
        }),
        coverImageId: v.optional(v.id("_storage")),
        isPublic: v.boolean(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const groupId = await ctx.db.insert("groups", {
            name: args.name,
            description: args.description,
            category: args.category,
            tags: args.tags,
            city: args.city,
            coverImageId: args.coverImageId,
            createdBy: user._id,
            isPublic: args.isPublic,
        });

        // Initialize default channels
        await createDefaultChannels(ctx, groupId);

        // Auto-add creator as founder (implies manager)
        await ctx.db.insert("groupMembers", {
            groupId,
            userId: user._id,
            role: "founder",
            joinedAt: Date.now(),
        });

        // Schedule semantic search embedding indexing
        await ctx.scheduler.runAfter(0, internal.ai.indexGroupEmbedding, { groupId });

        return groupId;
    },
});

export const updateGroup = mutation({
    args: {
        groupId: v.id("groups"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        coverImageId: v.optional(v.id("_storage")),
        isPublic: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Verify manager role
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can edit the group");
        }

        const { groupId, ...updates } = args;
        const cleanUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) cleanUpdates[key] = value;
        }

        await ctx.db.patch(groupId, cleanUpdates);

        // Re-index semantic search embedding on update
        await ctx.scheduler.runAfter(0, internal.ai.indexGroupEmbedding, { groupId: args.groupId });
    },
});

export const updateMemberRole = mutation({
    args: {
        groupId: v.id("groups"),
        targetUserId: v.string(),
        role: v.union(v.literal("manager"), v.literal("member")),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Verify caller is manager/founder
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can manage roles");
        }

        // Can't demote yourself
        if (args.targetUserId === user._id && args.role === "member") {
            throw new Error("Cannot demote yourself. Ask another manager to do it, or leave the group.");
        }

        const targetMembership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", args.targetUserId))
            .first();

        if (!targetMembership) throw new Error("Target user is not a member");
        if (targetMembership.role === "founder") throw new Error("Cannot change founder role — use Transfer Founder instead");

        const group = await ctx.db.get(args.groupId);
        if (!group) throw new Error("Group not found");
        if (args.targetUserId === group.createdBy) {
            throw new Error("Cannot change role of the group creator");
        }

        // Governance enforcement: block demotions when governance is violated
        if (targetMembership.role === "manager" && args.role === "member") {
            const allMembers = await ctx.db
                .query("groupMembers")
                .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
                .collect();
            const managerCount = allMembers.filter(m => m.role === "manager" || m.role === "founder").length;

            // Can't demote if already in governance violation (< 2 managers with > 3 members)
            const isGovernanceMode = allMembers.length > 3;
            if (isGovernanceMode && managerCount <= 2) {
                throw new Error("Cannot demote — governance requires at least 2 managers for groups with more than 3 members.");
            }

            // Safety: never demote the last manager
            if (managerCount <= 1) {
                throw new Error("Cannot demote the last manager. Promote someone else first.");
            }
        }

        await ctx.db.patch(targetMembership._id, { role: args.role });

        // 🟡 Governance alert if promoting — notify the promoted user (Important)
        if (args.role === "manager") {
            const targetProfile = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", args.targetUserId)).first();
            const groupData = await ctx.db.get(args.groupId);
            if (groupData) {
                await notifyUser(ctx, args.targetUserId, `You've been promoted to manager in "${groupData.name}"`, "governance_alert", { groupId: args.groupId }, args.groupId);
            }
        }

        // Log governance action
        await logGovernanceAction(ctx, args.groupId, args.role === "manager" ? "promotion" : "demotion", user._id, `Changed role of member to ${args.role}`, args.targetUserId);
    },
});

// ─── Remove Member (Instant Moderation) ─────────────────────────────
export const removeMember = mutation({
    args: {
        groupId: v.id("groups"),
        targetUserId: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Verify caller is manager/founder
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can remove members");
        }

        // Can't remove yourself — use leaveGroup
        if (args.targetUserId === user._id) {
            throw new Error("Cannot remove yourself. Use Leave Group instead.");
        }

        const targetMembership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", args.targetUserId))
            .first();

        if (!targetMembership) throw new Error("Target user is not a member");

        const group = await ctx.db.get(args.groupId);
        if (!group) throw new Error("Group not found");

        // Cannot remove founder
        if (targetMembership.role === "founder" || args.targetUserId === group.createdBy) {
            throw new Error("Cannot remove the founder. Founders can only be changed via Transfer Founder.");
        }

        // Cannot remove other managers (future: requires majority vote)
        if (targetMembership.role === "manager") {
            throw new Error("Cannot remove a manager. Demote them first, then remove.");
        }

        // Governance check: block removals during violation
        const allMembers = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
        const isGovernanceMode = allMembers.length > 3;
        if (isGovernanceMode) {
            const managerCount = allMembers.filter(m => m.role === "manager" || m.role === "founder").length;
            if (managerCount < 2) {
                throw new Error("Governance violation: promote another manager before modifying membership.");
            }
        }

        // Remove the member
        await ctx.db.delete(targetMembership._id);

        // Log governance action
        await logGovernanceAction(ctx, args.groupId, "removal", user._id, "Removed member from group", args.targetUserId);
    },
});

// ─── Transfer Founder ───────────────────────────────────────────────
export const transferFounder = mutation({
    args: {
        groupId: v.id("groups"),
        targetUserId: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Only the current founder can transfer
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || membership.role !== "founder") {
            throw new Error("Only the founder can transfer founder role");
        }

        // Target must be an existing manager
        const targetMembership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", args.targetUserId))
            .first();

        if (!targetMembership) throw new Error("Target user is not a member");
        if (targetMembership.role !== "manager") {
            throw new Error("Can only transfer founder role to an existing manager. Promote them first.");
        }

        // Swap roles: current founder → manager, target → founder
        await ctx.db.patch(membership._id, { role: "manager" });
        await ctx.db.patch(targetMembership._id, { role: "founder" });

        // Update group.createdBy to new founder
        await ctx.db.patch(args.groupId, { createdBy: args.targetUserId });

        // Log governance action
        await logGovernanceAction(ctx, args.groupId, "transfer_founder", user._id, "Transferred founder role", args.targetUserId);
    },
});

export const deleteGroup = mutation({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Only the founder can delete the group
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership || membership.role !== "founder") {
            throw new Error("Only the founder can delete the group");
        }

        // Delete all members
        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
        for (const m of members) await ctx.db.delete(m._id);

        // Delete all join requests
        const requests = await ctx.db
            .query("joinRequests")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
        for (const r of requests) await ctx.db.delete(r._id);

        // Delete all votes
        const allRequests = await ctx.db
            .query("joinRequests")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
        for (const req of allRequests) {
            const votes = await ctx.db
                .query("votes")
                .withIndex("by_request", (q) => q.eq("requestId", req._id))
                .collect();
            for (const vote of votes) await ctx.db.delete(vote._id);
        }

        // Delete the group
        await ctx.db.delete(args.groupId);
    },
});

export const requestToJoin = mutation({
    args: {
        groupId: v.id("groups"),
        message: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (args.message && args.message.length > 300) {
            throw new Error("Message must be 300 characters or less");
        }
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Check if already a member
        const existing = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (existing) throw new Error("Already a member");

        // Check if already requested
        const existingRequest = await ctx.db
            .query("joinRequests")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (existingRequest && (existingRequest.status === "pending" || existingRequest.status === "voting")) {
            throw new Error("Request already pending or in voting");
        }

        // If group is public, auto-join; otherwise create request
        const group = await ctx.db.get(args.groupId);
        if (!group) throw new Error("Group not found");

        // ALL groups require a join request (Intent Barrier)
        // Public groups are just visible, not open-access.

        // Create join request for all groups
        await ctx.db.insert("joinRequests", {
            groupId: args.groupId,
            userId: user._id,
            status: "pending",
            message: args.message,
        });

        // 🔴 Notify all managers about the join request (Critical)
        const requesterProfile = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();
        const requesterName = requesterProfile?.name ?? "Someone";
        const managers = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();
        for (const m of managers) {
            if ((m.role === "manager" || m.role === "founder") && m.userId !== user._id) {
                await notifyUser(
                    ctx, m.userId,
                    `${requesterName} requested to join "${group.name}"`,
                    "join_request",
                    { groupId: args.groupId },
                    args.groupId,
                );
            }
        }

        return { joined: false, status: "pending" };
    },
});

// ─── Helper: Send a notification ───
async function notifyUser(ctx: any, userId: string, message: string, type: string, data: any = {}, groupId?: any) {
    const config: Record<string, { layer: string; icon: string; title: string }> = {
        join_request: { layer: "critical", icon: "governance", title: "Join Request" },
        join_result: { layer: "critical", icon: "governance", title: "Request Update" },
        vote_outcome: { layer: "critical", icon: "governance", title: "Request Update" },
        mention: { layer: "critical", icon: "message", title: "You were mentioned" },
        payment_success: { layer: "critical", icon: "payment", title: "Payment Confirmed" },
        governance_alert: { layer: "important", icon: "governance", title: "Governance Alert" },
        member_joined: { layer: "passive", icon: "member", title: "Member Joined" },
        member_left: { layer: "passive", icon: "member", title: "Member Left" },
    };

    const c = config[type] ?? { layer: "passive", icon: "message", title: "Notification" };

    await ctx.db.insert("notifications", {
        userId,
        type,
        layer: c.layer,
        title: c.title,
        message,
        icon: c.icon,
        data,
        groupId: groupId ?? data?.groupId ?? undefined,
        isRead: false,
        createdAt: Date.now(),
    });
}

// ─── Helper: Log Governance Action ───
async function logGovernanceAction(ctx: any, groupId: any, actionType: string, actorId: string, details?: string, targetUserId?: string, requestId?: any) {
    await ctx.db.insert("governanceLogs", {
        groupId,
        actionType,
        actorId,
        details,
        targetUserId,
        requestId,
        createdAt: Date.now(),
    });
}

// ─── Helper: Approve a join request (shared logic) ───
async function approveJoinRequest(ctx: any, requestId: any, request: any, actorId: string) {
    await ctx.db.patch(requestId, { status: "approved", resolvedAt: Date.now() });
    await ctx.db.insert("groupMembers", {
        groupId: request.groupId,
        userId: request.userId,
        role: "member",
        joinedAt: Date.now(),
    });
    const group = await ctx.db.get(request.groupId);
    if (group) {
        // 🔴 Notify requester (Critical)
        await notifyUser(ctx, request.userId, `Your request to join "${group.name}" has been approved!`, "join_result", { groupId: request.groupId }, request.groupId);

        // ⚪ Notify other members about new member (Passive)
        const newMemberProfile = await ctx.db.query("users").withIndex("by_userId", (q: any) => q.eq("userId", request.userId)).first();
        const memberName = newMemberProfile?.name ?? "A new member";
        const members = await ctx.db.query("groupMembers").withIndex("by_group", (q: any) => q.eq("groupId", request.groupId)).collect();
        for (const m of members) {
            if (m.userId !== request.userId && m.userId !== actorId) {
                await notifyUser(ctx, m.userId, `${memberName} joined "${group.name}"`, "member_joined", { groupId: request.groupId }, request.groupId);
            }
        }
    }

    // Log governance action
    await logGovernanceAction(ctx, request.groupId, "vote_resolution_approved", actorId, "Join request approved", request.userId, requestId);
}

// ─── Helper: Check Majority & Resolve ───
async function checkMajorityAndResolve(ctx: any, requestId: any, groupId: any, managerCount: number, actorId: string) {
    const request = await ctx.db.get(requestId);
    if (!request || request.status !== "voting") return;

    const votes = await ctx.db
        .query("votes")
        .withIndex("by_request", (q: any) => q.eq("requestId", requestId))
        .collect();

    const approveCount = votes.filter((v: any) => v.vote === "approve").length;
    const rejectCount = votes.filter((v: any) => v.vote === "reject").length;

    if (approveCount * 2 >= managerCount) {
        await approveJoinRequest(ctx, requestId, request, actorId);
    } else if (rejectCount * 2 > managerCount) {
        await ctx.db.patch(requestId, { status: "rejected", resolvedAt: Date.now() });
        const group = await ctx.db.get(groupId);
        const groupName = group ? group.name : "the group";
        await notifyUser(ctx, request.userId, `Your request to join "${groupName}" was declined.`, "join_result", { groupId }, groupId);

        // Log governance action
        await logGovernanceAction(ctx, groupId, "vote_resolution_rejected", actorId, "Join request rejected by vote", request.userId, requestId);
    }
}

export const handleJoinRequest = mutation({
    args: {
        requestId: v.id("joinRequests"),
        action: v.union(v.literal("approve"), v.literal("reject")),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const request = await ctx.db.get(args.requestId);
        if (!request) throw new Error("Request not found");
        if (request.status !== "pending") throw new Error("Request already processed");

        // Verify caller is manager/founder
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", request.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can handle requests");
        }

        const group = await ctx.db.get(request.groupId);
        if (!group) throw new Error("Group not found");

        // Count members to determine governance mode
        const currentMembers = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", request.groupId))
            .collect();
        const isBootstrap = currentMembers.length <= 3;

        if (isBootstrap) {
            // ─── BOOTSTRAP MODE: Direct approve/reject ───
            if (args.action === "approve") {
                await approveJoinRequest(ctx, args.requestId, request, user._id);
            } else {
                await ctx.db.patch(args.requestId, { status: "rejected", resolvedAt: Date.now() });
                await notifyUser(ctx, request.userId, `Your request to join "${group.name}" was declined.`, "join_result", { groupId: request.groupId }, request.groupId);
            }
        } else {
            // ─── GOVERNANCE MODE: Require majority vote ───
            // Enforce manager count rule
            const members = await ctx.db
                .query("groupMembers")
                .withIndex("by_group", (q) => q.eq("groupId", request.groupId))
                .collect();
            const managerCount = members.filter(m => m.role === "manager" || m.role === "founder").length;

            if (managerCount < 2) {
                throw new Error("GOVERNANCE_ERROR_PROMOTE_REQUIRED: Group size > 3 requires at least 2 managers. Promote a member first.");
            }

            // Transition request to voting state
            const requiredVotes = Math.floor(managerCount / 2) + 1; // simple majority
            await ctx.db.patch(args.requestId, {
                status: "voting",
                requiredVotes,
            });

            // Auto-cast the initiating manager's vote
            await ctx.db.insert("votes", {
                requestId: args.requestId,
                groupId: request.groupId,
                voterId: user._id,
                vote: args.action,
                castAt: Date.now(),
            });

            // If only 2 managers and one votes, check if majority already met
            await checkMajorityAndResolve(ctx, args.requestId, request.groupId, managerCount, user._id);
        }
    },
});

export const castVote = mutation({
    args: {
        requestId: v.id("joinRequests"),
        vote: v.union(v.literal("approve"), v.literal("reject")),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const request = await ctx.db.get(args.requestId);
        if (!request) throw new Error("Request not found");
        if (request.status !== "voting") throw new Error("This request is not in voting phase");

        // Verify caller is manager
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", request.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can vote");
        }

        // Check if already voted
        const existingVote = await ctx.db
            .query("votes")
            .withIndex("by_request_voter", (q) =>
                q.eq("requestId", args.requestId).eq("voterId", user._id)
            )
            .first();
        if (existingVote) throw new Error("You have already voted on this request");

        // Cast vote
        await ctx.db.insert("votes", {
            requestId: args.requestId,
            groupId: request.groupId,
            voterId: user._id,
            vote: args.vote,
            castAt: Date.now(),
        });

        // Check if majority reached
        const allVotes = await ctx.db
            .query("votes")
            .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
            .collect();

        const approveCount = allVotes.filter(v => v.vote === "approve").length;
        const rejectCount = allVotes.filter(v => v.vote === "reject").length;

        // Get current manager count for majority calculation
        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", request.groupId))
            .collect();
        const managerCount = members.filter(m => m.role === "manager" || m.role === "founder").length;
        // Governance Check: Voting requires at least 2 managers
        // (Prevent single manager from bypassing governance in compromised state)
        if (managerCount < 2) {
            throw new Error("Governance violation: voting disabled until you promote another manager (min 2 required).");
        }

        // Check majority (Approvals >= 50% of managers)
        // Tie counts as approval.
        await checkMajorityAndResolve(ctx, args.requestId, request.groupId, managerCount, user._id);
        // Otherwise: still waiting for more votes
    },
});

export const getRequestVotes = query({
    args: { requestId: v.id("joinRequests") },
    handler: async (ctx, args) => {
        const votes = await ctx.db
            .query("votes")
            .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
            .collect();

        const approveCount = votes.filter(v => v.vote === "approve").length;
        const rejectCount = votes.filter(v => v.vote === "reject").length;

        return {
            total: votes.length,
            approve: approveCount,
            reject: rejectCount,
        };
    },
});

export const leaveGroup = mutation({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (!membership) throw new Error("Not a member");
        if (membership.role === "founder") {
            throw new Error("Founders cannot leave. Transfer founder role first, or delete the group.");
        }

        // Check governance constraints for managers
        if (membership.role === "manager") {
            const group = await ctx.db.get(args.groupId);
            if (!group) throw new Error("Group not found");

            const members = await ctx.db
                .query("groupMembers")
                .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
                .collect();

            const managerCount = members.filter(m => m.role === "manager" || m.role === "founder").length;

            // Never let the last manager leave
            if (managerCount <= 1 && members.length > 1) {
                throw new Error("Last manager cannot leave. Promote someone else first or delete the group.");
            }

            // Governance: can't leave if it would violate the 2-manager rule
            const isGovernanceMode = members.length > 3;
            if (isGovernanceMode && managerCount <= 2) {
                throw new Error("Cannot leave — governance requires at least 2 managers. Promote another member first.");
            }
        }

        await ctx.db.delete(membership._id);

        // ⚪ Notify managers about member leaving (Passive)
        const group = await ctx.db.get(args.groupId);
        if (group) {
            const profile = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", user._id)).first();
            const name = profile?.name ?? "A member";
            const remaining = await ctx.db.query("groupMembers").withIndex("by_group", (q) => q.eq("groupId", args.groupId)).collect();
            for (const m of remaining) {
                if (m.role === "manager" || m.role === "founder") {
                    await notifyUser(ctx, m.userId, `${name} left "${group.name}"`, "member_left", { groupId: args.groupId }, args.groupId);
                }
            }
        }
    },
});

// ─── File Upload ────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");
        return await ctx.storage.generateUploadUrl();
    },
});

// ─── Queries ────────────────────────────────────────────────────────

export const listPublicGroups = query({
    args: {
        category: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let groups;

        if (args.category) {
            groups = await ctx.db
                .query("groups")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .collect();
            groups = groups.filter((g) => g.isPublic);
        } else {
            groups = await ctx.db.query("groups").collect();
            groups = groups.filter((g) => g.isPublic);
        }

        // Enrich with cover image URLs and member counts
        return Promise.all(
            groups.map(async (group) => {
                const members = await ctx.db
                    .query("groupMembers")
                    .withIndex("by_group", (q) => q.eq("groupId", group._id))
                    .collect();
                return {
                    ...group,
                    memberCount: members.length,
                    coverImageUrl: group.coverImageId
                        ? await ctx.storage.getUrl(group.coverImageId)
                        : null,
                };
            })
        );
    },
});

export const getGroup = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const group = await ctx.db.get(args.groupId);
        if (!group) return null;

        const coverImageUrl = group.coverImageId
            ? await ctx.storage.getUrl(group.coverImageId)
            : null;

        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();

        return { ...group, coverImageUrl, memberCount: members.length };
    },
});

export const getMyGroups = query({
    args: {},
    handler: async (ctx) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        const memberships = await ctx.db
            .query("groupMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const groups = await Promise.all(
            memberships.map(async (m) => {
                const group = await ctx.db.get(m.groupId);
                if (!group) return null;
                const coverImageUrl = group.coverImageId
                    ? await ctx.storage.getUrl(group.coverImageId)
                    : null;
                const groupMembers = await ctx.db
                    .query("groupMembers")
                    .withIndex("by_group", (q) => q.eq("groupId", m.groupId))
                    .collect();
                return { ...group, coverImageUrl, myRole: m.role, memberCount: groupMembers.length };
            })
        );

        return groups.filter(Boolean);
    },
});

export const getGroupMembers = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();

        // Enrich with user profile
        return Promise.all(
            members.map(async (m) => {
                const profile = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", m.userId))
                    .first();

                let avatarUrl = null;
                if (profile?.imageUrl) {
                    avatarUrl = await ctx.storage.getUrl(
                        profile.imageUrl as any
                    );
                }

                return {
                    ...m,
                    name: profile?.name || "Unknown",
                    avatarUrl,
                    bio: profile?.bio,
                    city: profile?.city?.name ?? "Unknown",
                };
            })
        );
    },
});

export const getJoinRequests = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        // Verify manager
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) return [];

        const requests = await ctx.db
            .query("joinRequests")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();

        // Only pending
        const pending = requests.filter((r) => r.status === "pending");

        return Promise.all(
            pending.map(async (r) => {
                const profile = await ctx.db
                    .query("users")
                    .withIndex("by_userId", (q) => q.eq("userId", r.userId))
                    .first();

                let avatarUrl = null;
                if (profile?.imageUrl) {
                    avatarUrl = await ctx.storage.getUrl(
                        profile.imageUrl as any
                    );
                }

                return {
                    ...r,
                    name: profile?.name || "Unknown",
                    avatarUrl,
                    interests: profile?.interests || [],
                };
            })
        );
    },
});

export const getMyJoinRequestStatus = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        // Check membership first
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (membership) {
            return { status: "member" as const, role: membership.role, userId: user._id };
        }

        // Check pending request
        const request = await ctx.db
            .query("joinRequests")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (request && request.status === "pending") {
            return { status: "pending" as const, role: null, userId: user._id };
        }

        return { status: "none" as const, role: null, userId: user._id };
    },
});

export const getGroupEvents = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const events = await ctx.db
            .query("events")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();

        const now = Date.now();

        // Compute display status for each event and resolve cover image
        const enriched = await Promise.all(events.map(async (e) => {
            const endTime = e.endTime || e.startTime;
            const computedStatus = e.status === "cancelled" ? "cancelled"
                : e.status === "completed" || now > endTime ? "completed"
                    : e.startTime <= now ? "ongoing"
                        : "upcoming";
            const coverImageUrl = e.coverImageId ? await ctx.storage.getUrl(e.coverImageId) : null;
            return { ...e, computedStatus, coverImageUrl };
        }));

        // Sort: upcoming/ongoing first (by startTime asc), then completed/cancelled (by startTime desc)
        enriched.sort((a, b) => {
            const aActive = a.computedStatus === "upcoming" || a.computedStatus === "ongoing";
            const bActive = b.computedStatus === "upcoming" || b.computedStatus === "ongoing";
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            if (aActive && bActive) return a.startTime - b.startTime;
            return b.startTime - a.startTime;
        });

        return enriched;
    },
});

// ─── Online Presence ───

export const heartbeat = mutation({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return;

        const existing = await ctx.db
            .query("presence")
            .withIndex("by_group_user", (q) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
        } else {
            await ctx.db.insert("presence", {
                groupId: args.groupId,
                userId: user._id,
                lastSeenAt: Date.now(),
            });
        }
    },
});

export const getOnlineMembers = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
            .collect();

        const memberIds = members.map((m) => m.userId);
        const now = Date.now();
        const ONLINE_THRESHOLD = 35_000; // 35 seconds (heartbeat is 15s)

        const presenceEntries = await Promise.all(
            memberIds.map((userId) =>
                ctx.db
                    .query("userPresence")
                    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
                    .first()
            )
        );

        return presenceEntries
            .filter((e) => e && now - e.lastSeenAt < ONLINE_THRESHOLD)
            .map((e) => e!.userId);
    },
});

// ─── Group Stats (real data) ───

export const getGroupStats = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return null;

        // Member count
        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
            .collect();
        const memberCount = members.length;

        // Online count (from userPresence)
        const now = Date.now();
        const ONLINE_THRESHOLD = 35_000;
        const memberIds = members.map((m: any) => m.userId);
        const presenceEntries = await Promise.all(
            memberIds.map((userId: string) =>
                ctx.db
                    .query("userPresence")
                    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
                    .first()
            )
        );
        const onlineCount = presenceEntries.filter(
            (e) => e && now - e.lastSeenAt < ONLINE_THRESHOLD
        ).length;

        // Message count (all messages in group)
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
            .collect();
        const messageCount = messages.filter((m: any) => !m.isDeleted).length;

        // Event count
        const events = await ctx.db
            .query("events")
            .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
            .collect();
        const eventCount = events.length;

        return { memberCount, onlineCount, messageCount, eventCount };
    },
});

// ─── Governance Audit Logs ───

export const getGovernanceLogs = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        // Verify membership
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q: any) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership) return [];

        const logs = await ctx.db
            .query("governanceLogs")
            .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
            .order("desc")
            .take(50);

        // Batch-collect unique user IDs for efficient lookup
        const userIds = new Set<string>();
        for (const log of logs) {
            userIds.add(log.actorId);
            if (log.targetUserId) userIds.add(log.targetUserId);
        }
        const userProfiles = await Promise.all(
            [...userIds].map(async (id) => {
                const u = await ctx.db.query("users").withIndex("by_userId", (q: any) => q.eq("userId", id)).first();
                return [id, u?.name || "Unknown"] as const;
            })
        );
        const nameMap = new Map(userProfiles);

        return logs.map((log: any) => ({
            ...log,
            actorName: nameMap.get(log.actorId) || "System",
            targetName: log.targetUserId ? nameMap.get(log.targetUserId) || "Unknown" : null,
        }));
    },
});

// ─── Democratic Governance Proposals (Demote / Kick) ───

export const proposeAction = mutation({
    args: {
        groupId: v.id("groups"),
        actionType: v.union(v.literal("demote"), v.literal("kick"), v.literal("promote"), v.literal("revert_promotion"), v.literal("revert_demotion"), v.literal("revert_removal")),
        targetUserId: v.string(),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        // Verify caller is manager/founder
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q: any) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can propose actions");
        }

        // Cannot target yourself
        if (args.targetUserId === user._id) {
            throw new Error("Cannot propose an action against yourself.");
        }

        // Cannot target the founder
        const group = await ctx.db.get(args.groupId);
        if (!group) throw new Error("Group not found");
        if (args.targetUserId === group.createdBy) {
            throw new Error("Cannot propose actions against the founder.");
        }

        // Target must be a member
        const targetMembership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q: any) =>
                q.eq("groupId", args.groupId).eq("userId", args.targetUserId)
            )
            .first();

        // For revert_removal, target is NOT a member (that's expected)
        if (args.actionType === "revert_removal") {
            if (targetMembership) throw new Error("User is already a member — nothing to revert.");
        } else {
            if (!targetMembership) throw new Error("Target is not a member");

            // Validate action type against target's current role
            if (args.actionType === "kick" && targetMembership.role !== "member") {
                throw new Error("Cannot kick a manager. Propose a demotion first.");
            }
            if (args.actionType === "demote" && targetMembership.role !== "manager") {
                throw new Error("Target is not a manager — nothing to demote.");
            }
            if (args.actionType === "promote" && targetMembership.role !== "member") {
                throw new Error("Target is already a manager.");
            }
            if (args.actionType === "revert_promotion" && targetMembership.role !== "manager") {
                throw new Error("Target is not a manager — nothing to revert.");
            }
            if (args.actionType === "revert_demotion" && targetMembership.role !== "member") {
                throw new Error("Target is already a manager — nothing to revert.");
            }
        }

        // Check no duplicate active proposal for same target+action
        const existing = await ctx.db
            .query("governanceProposals")
            .withIndex("by_group_status", (q: any) =>
                q.eq("groupId", args.groupId).eq("status", "voting")
            )
            .collect();
        const dup = existing.find(
            (p: any) => p.targetUserId === args.targetUserId && p.actionType === args.actionType
        );
        if (dup) throw new Error("There is already an active proposal for this action.");

        // Calculate required votes (majority of all managers)
        const allMembers = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
            .collect();
        const managerCount = allMembers.filter((m: any) => m.role === "manager" || m.role === "founder").length;
        const requiredVotes = Math.floor(managerCount / 2) + 1;

        const proposalId = await ctx.db.insert("governanceProposals", {
            groupId: args.groupId,
            actionType: args.actionType,
            proposerId: user._id,
            targetUserId: args.targetUserId,
            reason: args.reason,
            status: "voting",
            requiredVotes,
            createdAt: Date.now(),
        });

        // Auto-cast proposer's approval vote
        await ctx.db.insert("proposalVotes", {
            proposalId,
            voterId: user._id,
            vote: "approve",
            castAt: Date.now(),
        });

        // Log the proposal
        await logGovernanceAction(
            ctx, args.groupId,
            `proposal_${args.actionType}`,
            user._id,
            `Proposed to ${args.actionType} member${args.reason ? `: ${args.reason}` : ""}`,
            args.targetUserId
        );

        // If only 1 required vote (solo manager), execute immediately
        if (requiredVotes <= 1) {
            await executeProposal(ctx, proposalId, args.groupId, user._id);
        }
    },
});

export const voteOnProposal = mutation({
    args: {
        proposalId: v.id("governanceProposals"),
        vote: v.union(v.literal("approve"), v.literal("reject")),
    },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) throw new Error("Unauthorized");

        const proposal = await ctx.db.get(args.proposalId);
        if (!proposal) throw new Error("Proposal not found");
        if (proposal.status !== "voting") throw new Error("Proposal is no longer active");

        // Verify caller is manager/founder
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q: any) =>
                q.eq("groupId", proposal.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) {
            throw new Error("Only managers can vote on proposals");
        }

        // Cannot vote on your own demotion/kick
        if (proposal.targetUserId === user._id) {
            throw new Error("Cannot vote on a proposal targeting yourself.");
        }

        // Check if already voted
        const existingVote = await ctx.db
            .query("proposalVotes")
            .withIndex("by_proposal_voter", (q: any) =>
                q.eq("proposalId", args.proposalId).eq("voterId", user._id)
            )
            .first();
        if (existingVote) throw new Error("You have already voted on this proposal");

        await ctx.db.insert("proposalVotes", {
            proposalId: args.proposalId,
            voterId: user._id,
            vote: args.vote,
            castAt: Date.now(),
        });

        // Check majority
        const allVotes = await ctx.db
            .query("proposalVotes")
            .withIndex("by_proposal", (q: any) => q.eq("proposalId", args.proposalId))
            .collect();

        const approveCount = allVotes.filter((v: any) => v.vote === "approve").length;
        const rejectCount = allVotes.filter((v: any) => v.vote === "reject").length;

        const allMembers = await ctx.db
            .query("groupMembers")
            .withIndex("by_group", (q: any) => q.eq("groupId", proposal.groupId))
            .collect();
        const managerCount = allMembers.filter((m: any) => m.role === "manager" || m.role === "founder").length;

        if (approveCount >= proposal.requiredVotes) {
            await executeProposal(ctx, args.proposalId, proposal.groupId, user._id);
        } else if (rejectCount > managerCount - proposal.requiredVotes) {
            // Impossible to reach majority — reject
            await ctx.db.patch(args.proposalId, { status: "rejected", resolvedAt: Date.now() });
            await logGovernanceAction(
                ctx, proposal.groupId,
                `proposal_${proposal.actionType}_rejected`,
                user._id,
                `Proposal to ${proposal.actionType} rejected by vote`,
                proposal.targetUserId
            );
        }
    },
});

async function executeProposal(ctx: any, proposalId: any, groupId: any, actorId: string) {
    const proposal = await ctx.db.get(proposalId);
    if (!proposal || proposal.status !== "voting") return;

    const targetMembership = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_user", (q: any) =>
            q.eq("groupId", groupId).eq("userId", proposal.targetUserId)
        )
        .first();

    if (!targetMembership) {
        // For revert_removal, the user is NOT a member — that's expected
        if (proposal.actionType === "revert_removal") {
            await ctx.db.insert("groupMembers", {
                groupId,
                userId: proposal.targetUserId,
                role: "member",
                joinedAt: Date.now(),
            });
            await logGovernanceAction(ctx, groupId, "revert_removal", actorId, "Removal reverted by democratic vote — member reinstated", proposal.targetUserId);
            const group = await ctx.db.get(groupId);
            if (group) {
                await notifyUser(ctx, proposal.targetUserId, `You have been reinstated to "${group.name}" by democratic vote.`, "info", { groupId });
            }
            await ctx.db.patch(proposalId, { status: "approved", resolvedAt: Date.now() });
            return;
        }
        await ctx.db.patch(proposalId, { status: "expired", resolvedAt: Date.now() });
        return;
    }

    if (proposal.actionType === "demote" || proposal.actionType === "revert_promotion") {
        await ctx.db.patch(targetMembership._id, { role: "member" });
        await logGovernanceAction(ctx, groupId, "demotion", actorId, proposal.actionType === "revert_promotion" ? "Promotion reverted by democratic vote" : "Demoted by democratic vote", proposal.targetUserId);
    } else if (proposal.actionType === "promote" || proposal.actionType === "revert_demotion") {
        await ctx.db.patch(targetMembership._id, { role: "manager" });
        await logGovernanceAction(ctx, groupId, "promotion", actorId, proposal.actionType === "revert_demotion" ? "Demotion reverted by democratic vote" : "Promoted by democratic vote", proposal.targetUserId);
    } else if (proposal.actionType === "kick") {
        await ctx.db.delete(targetMembership._id);
        await logGovernanceAction(ctx, groupId, "removal", actorId, "Removed by democratic vote", proposal.targetUserId);
        const group = await ctx.db.get(groupId);
        if (group) {
            await notifyUser(ctx, proposal.targetUserId, `You were removed from "${group.name}" by democratic vote.`, "alert", { groupId });
        }
    }

    await ctx.db.patch(proposalId, { status: "approved", resolvedAt: Date.now() });
}

export const getActiveProposals = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getAuthUserSafe(ctx);
        if (!user) return [];

        // Verify manager
        const membership = await ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q: any) =>
                q.eq("groupId", args.groupId).eq("userId", user._id)
            )
            .first();
        if (!membership || (membership.role !== "manager" && membership.role !== "founder")) return [];

        const proposals = await ctx.db
            .query("governanceProposals")
            .withIndex("by_group_status", (q: any) =>
                q.eq("groupId", args.groupId).eq("status", "voting")
            )
            .collect();

        // Batch-resolve user names
        const allUserIds = new Set<string>();
        for (const p of proposals) {
            allUserIds.add(p.proposerId);
            allUserIds.add(p.targetUserId);
        }
        const userMap = new Map<string, string>();
        await Promise.all(
            Array.from(allUserIds).map(async (uid) => {
                const u = await ctx.db.query("users").withIndex("by_userId", (q: any) => q.eq("userId", uid)).first();
                userMap.set(uid, u?.name || "Unknown");
            })
        );

        // Fetch votes + build results
        const results = await Promise.all(
            proposals.map(async (p: any) => {
                const votes = await ctx.db
                    .query("proposalVotes")
                    .withIndex("by_proposal", (q: any) => q.eq("proposalId", p._id))
                    .collect();
                const myVote = votes.find((v: any) => v.voterId === user._id);

                return {
                    ...p,
                    proposerName: userMap.get(p.proposerId) || "Unknown",
                    targetName: userMap.get(p.targetUserId) || "Unknown",
                    approveCount: votes.filter((v: any) => v.vote === "approve").length,
                    rejectCount: votes.filter((v: any) => v.vote === "reject").length,
                    totalVotes: votes.length,
                    myVote: myVote?.vote || null,
                    isTarget: p.targetUserId === user._id,
                };
            })
        );

        return results;
    },
});

// ─── Auto-expire stale proposals (48h) — called by cron ───
export const expireStaleProposals = internalMutation({
    handler: async (ctx) => {
        const cutoff = Date.now() - 48 * 60 * 60 * 1000;
        const votingProposals = await ctx.db
            .query("governanceProposals")
            .filter((q) => q.eq(q.field("status"), "voting"))
            .collect();

        let expired = 0;
        for (const p of votingProposals) {
            if (p.createdAt < cutoff) {
                await ctx.db.patch(p._id, { status: "expired", resolvedAt: Date.now() });
                await ctx.db.insert("governanceLogs", {
                    groupId: p.groupId,
                    actionType: "proposal_expired",
                    actorId: "system",
                    targetUserId: p.targetUserId,
                    details: `Proposal to ${p.actionType} expired after 48 hours without majority`,
                    createdAt: Date.now(),
                });
                expired++;
            }
        }
        return { expired };
    },
});

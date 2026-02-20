import { DatabaseReader } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export async function isGroupAtRisk(db: DatabaseReader, groupId: Id<"groups">) {
    const group = await db.get(groupId);
    if (!group) return false;

    // Count members from groupMembers table (derived, not stored)
    const allMembers = await db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect();

    // Bootstrap mode: No checks for small groups
    if (allMembers.length <= 3) return false;

    const managers = await db
        .query("groupMembers")
        .withIndex("by_group_role", (q) => q.eq("groupId", groupId).eq("role", "manager"))
        .collect();

    const founders = await db
        .query("groupMembers")
        .withIndex("by_group_role", (q) => q.eq("groupId", groupId).eq("role", "founder"))
        .collect();

    const managerCount = managers.length + founders.length;

    return managerCount < 2;
}

export async function requireGovernanceHealthy(db: DatabaseReader, groupId: Id<"groups">) {
    if (await isGroupAtRisk(db, groupId)) {
        throw new Error("Governance At Risk: Action blocked until a second manager is promoted.");
    }
}

// ─── Full Governance Health Computation ───
export async function computeGovernanceHealth(db: DatabaseReader, groupId: Id<"groups">) {
    const allMembers = await db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect();

    const memberCount = allMembers.length;
    const managerCount = allMembers.filter(m => m.role === "manager" || m.role === "founder").length;
    const isBootstrap = memberCount <= 3;

    // ─── Vote Participation Rate ───
    // Look at proposals resolved in the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentProposals = await db
        .query("governanceProposals")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect();
    const resolvedRecent = recentProposals.filter(
        p => (p.status === "approved" || p.status === "rejected") && p.resolvedAt && p.resolvedAt > thirtyDaysAgo
    );

    let voteParticipationRate = 100; // default if no proposals
    if (resolvedRecent.length > 0) {
        let totalPossibleVotes = 0;
        let totalActualVotes = 0;
        for (const proposal of resolvedRecent) {
            const votes = await db
                .query("proposalVotes")
                .withIndex("by_proposal", (q) => q.eq("proposalId", proposal._id))
                .collect();
            totalActualVotes += votes.length;
            totalPossibleVotes += proposal.requiredVotes * 2; // all managers could vote (approx)
        }
        voteParticipationRate = totalPossibleVotes > 0
            ? Math.round((totalActualVotes / totalPossibleVotes) * 100)
            : 100;
    }

    // ─── Pending Decisions ───
    const pendingProposals = recentProposals.filter(p => p.status === "voting");
    const pendingJoinRequests = await db
        .query("joinRequests")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect();
    const pendingJoins = pendingJoinRequests.filter(r => r.status === "pending" || r.status === "voting");
    // Reconfirmations are now unified into governanceProposals
    const pendingReconfirmations = pendingProposals.filter(p => p.actionType === "reconfirm_manager");
    const pendingDecisions = pendingProposals.length + pendingJoins.length;

    // ─── Rule Compliance ───
    const hasMinManagers = isBootstrap || managerCount >= 2;
    const now = Date.now();
    const staleProposals = pendingProposals.filter(p => now > (p.expiresAt || (p.createdAt + 48 * 60 * 60 * 1000)));
    const noStaleProposals = staleProposals.length === 0;
    const ruleCompliance = (hasMinManagers ? 50 : 0) + (noStaleProposals ? 50 : 0);

    // ─── Overall Status ───
    let status: "healthy" | "low_participation" | "centralization_risk" = "healthy";
    if (!isBootstrap && managerCount < 2) {
        status = "centralization_risk";
    } else if (voteParticipationRate < 40) {
        status = "low_participation";
    } else if (ruleCompliance < 50) {
        status = "low_participation";
    }

    return {
        status,
        managerCount,
        memberCount,
        voteParticipationRate,
        pendingDecisions,
        ruleCompliance,
        pendingProposals: pendingProposals.length,
        pendingJoinRequests: pendingJoins.length,
        pendingReconfirmations: pendingReconfirmations.length,
        isBootstrap,
        resolvedProposalsLast30d: resolvedRecent.length,
    };
}

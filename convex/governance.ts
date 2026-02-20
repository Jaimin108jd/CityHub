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

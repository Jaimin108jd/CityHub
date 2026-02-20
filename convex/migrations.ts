import { internalMutation } from "./_generated/server";
import { createDefaultChannels } from "./channels";

export const backfillDefaultChannels = internalMutation({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("groups").collect();
        let totalBackfilled = 0;

        for (const group of groups) {
            // Check if group has channels
            const channels = await ctx.db
                .query("channels")
                .withIndex("by_group", (q) => q.eq("groupId", group._id))
                .first();

            if (!channels) {
                // No channels found, creates defaults
                await createDefaultChannels(ctx, group._id, group.createdBy);
                totalBackfilled++;
            }
        }

        return {
            totalGroups: groups.length,
            backfilled: totalBackfilled,
            message: `Backfilled ${totalBackfilled} groups with default channels.`
        };
    },
});

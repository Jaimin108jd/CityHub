import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync missing embeddings every hour — picks up any groups/events
// that were created but didn't get indexed (e.g. API was down)
crons.interval(
    "sync missing embeddings",
    { hours: 1 },
    internal.ai.syncMissingEmbeddings
);

// Auto-close expired polls every 15 minutes
crons.interval(
    "close expired polls",
    { minutes: 15 },
    internal.polls.closeExpiredPolls
);

// Auto-expire governance proposals older than 48h, every hour
crons.interval(
    "expire stale proposals",
    { hours: 1 },
    internal.groups.expireStaleProposals
);

export default crons;

"use client";

import { Id } from "@/convex/_generated/dataModel";

interface GroupGovernanceProps {
    groupId: Id<"groups">;
    onJumpToMessage?: (channelId: Id<"channels">, messageId: Id<"messages">) => void;
}

export function GroupGovernance({ groupId, onJumpToMessage }: GroupGovernanceProps) {
    return (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-4 bg-card border border-border rounded-md shadow-sm">
            <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-foreground">Governance</h2>
            <p className="text-muted-foreground text-sm max-w-md font-mono">To be built.</p>
        </div>
    );
}

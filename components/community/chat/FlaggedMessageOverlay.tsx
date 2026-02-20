"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { ShieldAlert, Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Inline overlay shown on AutoMod-blocked messages ───
interface FlaggedMessageOverlayProps {
    moderationFlag: {
        _id: Id<"moderationFlags">;
        category: string;
        severity: string;
        status: string;
        reason: string;
    };
    content: string;
    isManager: boolean;
    children?: React.ReactNode;
}

export function FlaggedMessageOverlay({ moderationFlag, content, isManager, children }: FlaggedMessageOverlayProps) {
    const [revealed, setRevealed] = useState(false);

    const isHidden = moderationFlag.status === "auto_hidden" || moderationFlag.status === "confirmed_hidden" || moderationFlag.status === "automod_blocked" || moderationFlag.severity === "high";

    const severityColor = {
        high: "border-red-500/30 bg-red-500/5",
        medium: "border-amber-500/30 bg-amber-500/5",
        low: "border-yellow-500/20 bg-yellow-500/5",
    }[moderationFlag.severity] ?? "border-border bg-muted/30";

    const severityIcon = moderationFlag.severity === "high"
        ? <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
        : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;

    // Hidden state — show block card with reveal option
    if (isHidden && !revealed) {
        return (
            <div className={cn("rounded-xl border p-3 my-1 max-w-80", severityColor)}>
                <div className="flex items-center gap-2 mb-1.5">
                    {severityIcon}
                    <span className="text-xs font-semibold text-foreground/80">
                        Message Blocked
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {moderationFlag.category.replace("_", " ")}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                    This message was blocked by AutoMod: {moderationFlag.reason}
                </p>
                {isManager && (
                    <button
                        onClick={() => setRevealed(true)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Eye className="w-3 h-3" />
                        Show anyway
                    </button>
                )}
            </div>
        );
    }

    // Revealed — show content with a subtle warning strip
    if (isHidden && revealed) {
        return (
            <div className="relative">
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-muted-foreground/60 italic flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Blocked content revealed
                    </span>
                    <button
                        onClick={() => setRevealed(false)}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Hide again
                    </button>
                </div>
                {children}
            </div>
        );
    }

    // Flagged but not hidden (low severity) — just show a subtle badge
    return (
        <div className="relative">
            {moderationFlag.status === "flagged" && (
                <div className={cn("flex items-center gap-1.5 mb-1 text-[11px]", severityColor, "rounded-lg px-2 py-1 w-fit")}>
                    {severityIcon}
                    <span className="text-muted-foreground">
                        Flagged: {moderationFlag.reason}
                    </span>
                </div>
            )}
            {children}
        </div>
    );
}

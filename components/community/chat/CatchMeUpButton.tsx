"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CatchMeUpButtonProps {
    channelId: Id<"channels">;
}

export function CatchMeUpButton({ channelId }: CatchMeUpButtonProps) {
    const summarize = useAction(api.ai.summarizeChat);
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState<{
        summary: string;
        messageCount: number;
        timeRange?: { from: number; to: number };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSummarize = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await summarize({ channelId, messageCount: 75 });
            if ((result as any)?.error) {
                toast.error("AI service temporarily unavailable");
                setSummary(result);
            } else {
                setSummary(result);
            }
        } catch (e: any) {
            toast.error("Something went wrong. Please try again.");
            setError(null); // don't show inline error, toast is enough
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSummary(null);
        setError(null);
    };

    // Summary panel is open
    if (summary) {
        const from = summary.timeRange
            ? new Date(summary.timeRange.from).toLocaleString([], {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })
            : null;
        const to = summary.timeRange
            ? new Date(summary.timeRange.to).toLocaleString([], {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })
            : null;

        return (
            <div className="border-b border-border bg-linear-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 animate-in slide-in-from-top-2 duration-300">
                <div className="px-4 py-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-violet-500/10 rounded-lg">
                                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                            </div>
                            <span className="text-sm font-semibold text-foreground">Catch Me Up</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mb-2.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {summary.messageCount} messages
                        </span>
                        {from && to && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {from} → {to}
                            </span>
                        )}
                    </div>

                    {/* Summary content */}
                    <div className="text-sm text-foreground/85 leading-relaxed prose prose-sm dark:prose-invert max-w-none
                        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_li]:text-sm
                        [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1
                        [&_strong]:text-foreground [&_strong]:font-semibold
                        max-h-48 overflow-y-auto scrollbar-thin pr-1">
                        {summary.summary.split("\n").map((line, i) => {
                            const trimmed = line.trim();
                            if (!trimmed) return null;
                            if (trimmed.startsWith("###") || trimmed.startsWith("**")) {
                                return (
                                    <h3 key={i}>
                                        {trimmed.replace(/^#{1,3}\s*/, "").replace(/\*\*/g, "")}
                                    </h3>
                                );
                            }
                            if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
                                return (
                                    <div key={i} className="flex gap-1.5 items-start py-0.5">
                                        <span className="text-violet-500 mt-1.5 shrink-0">•</span>
                                        <span>{trimmed.replace(/^[-*•]\s*/, "")}</span>
                                    </div>
                                );
                            }
                            return <p key={i} className="my-0.5">{trimmed}</p>;
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                <span className="text-sm text-destructive">{error}</span>
                <button onClick={handleClose} className="p-1 hover:bg-muted rounded-lg">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // Default: compact button
    return (
        <div className="flex justify-center py-1.5 border-b border-border/50">
            <Button
                variant="ghost"
                size="sm"
                onClick={handleSummarize}
                disabled={isLoading}
                className={cn(
                    "h-7 gap-1.5 text-xs font-medium rounded-full px-3",
                    "text-violet-600 dark:text-violet-400 hover:bg-violet-500/10",
                    "transition-all duration-200",
                    isLoading && "animate-pulse"
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Summarizing...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-3 h-3" />
                        Catch Me Up
                    </>
                )}
            </Button>
        </div>
    );
}

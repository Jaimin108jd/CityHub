"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, Check, BarChart2, Star, MessageSquareText, ThumbsUp, CheckSquare, Send, Undo2, Clock, Users } from "lucide-react";
import { toast } from "sonner";

interface PollOption { label: string; count: number; }
interface PollData {
    _id: Id<"polls">;
    question: string;
    pollType?: string;
    options: PollOption[];
    userVote?: number;
    userVoteIndices?: number[];
    isActive: boolean;
    isAnonymous?: boolean;
    allowMultiple?: boolean;
    expiresAt?: number;
    totalVoterCount?: number;
    recentVoters?: { name: string; userId: string }[];
}

// ─── Live Expiry Countdown ───
function ExpiryCountdown({ expiresAt }: { expiresAt: number }) {
    const [remaining, setRemaining] = useState(expiresAt - Date.now());

    useEffect(() => {
        const tick = () => setRemaining(expiresAt - Date.now());
        tick();
        const interval = setInterval(tick, 60000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    if (remaining <= 0) return <span className="text-destructive font-semibold">Expired</span>;

    const hours = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return <span>{days}d {hours % 24}h left</span>;
    }
    if (hours > 0) return <span>{hours}h {mins}m left</span>;
    return <span className="text-amber-500 font-semibold">{mins}m left</span>;
}

// ─── Rating Stars ───
function RatingDisplay({ poll, onVote, isVoting }: { poll: PollData; onVote: (idx: number) => void; isVoting: number | null }) {
    const totalVotes = poll.options.reduce((acc, opt) => acc + opt.count, 0);
    const hasVoted = poll.userVote !== undefined;
    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;
    const isClosed = !poll.isActive || isExpired;
    const avg = totalVotes > 0
        ? poll.options.reduce((acc, opt, i) => acc + opt.count * (i + 1), 0) / totalVotes
        : 0;

    if (hasVoted || isClosed) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={cn("w-5 h-5 transition-colors", n <= Math.round(avg) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20")} />
                    ))}
                    <span className="text-sm font-bold ml-1.5">{avg.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({totalVotes} vote{totalVotes !== 1 ? "s" : ""})</span>
                </div>
                {hasVoted && (
                    <p className="text-[10px] text-muted-foreground">You rated: {(poll.userVote ?? 0) + 1} ★</p>
                )}
                {/* Distribution bar */}
                <div className="space-y-0.5">
                    {[5, 4, 3, 2, 1].map(n => {
                        const count = poll.options[n - 1]?.count || 0;
                        const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                        return (
                            <div key={n} className="flex items-center gap-1.5 h-4">
                                <span className="text-[9px] font-mono text-muted-foreground w-3 text-right">{n}</span>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    onClick={() => onVote(n - 1)}
                    disabled={isVoting !== null}
                    className="p-1 hover:scale-125 transition-transform disabled:opacity-50"
                >
                    {isVoting === n - 1
                        ? <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        : <Star className="w-6 h-6 text-muted-foreground/30 hover:text-amber-400 hover:fill-amber-400 transition-colors" />
                    }
                </button>
            ))}
        </div>
    );
}

// ─── Feedback Form ───
function FeedbackDisplay({ poll }: { poll: PollData }) {
    const votePoll = useMutation(api.polls.votePoll);
    const responses = useQuery(api.polls.getPollResponses, { pollId: poll._id });
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const hasVoted = poll.userVote !== undefined;
    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;
    const isClosed = !poll.isActive || isExpired;

    // Check if user has already submitted by looking at responses
    const userSubmitted = responses?.some((r: any) => r.userId !== "anonymous" && r.textResponse);

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setSubmitting(true);
        try {
            const result = await votePoll({ pollId: poll._id, textResponse: text.trim() });
            if (result?.alreadyVoted) { toast.error("You've already submitted feedback"); return; }
            toast.success("Feedback submitted!");
            setText("");
        } catch (e: any) {
            toast.error(e.message || "Failed to submit");
        } finally { setSubmitting(false); }
    };

    return (
        <div className="space-y-2">
            {!isClosed && !hasVoted && !userSubmitted && (
                <div className="flex gap-1.5">
                    <Textarea
                        placeholder="Share your thoughts..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="min-h-12 text-xs resize-none flex-1"
                    />
                    <Button size="icon" className="shrink-0 h-8 w-8 mt-auto" onClick={handleSubmit} disabled={submitting || !text.trim()}>
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </Button>
                </div>
            )}
            {(hasVoted || userSubmitted) && !isClosed && (
                <p className="text-[10px] text-emerald-500 font-mono uppercase flex items-center gap-1">
                    <Check className="w-3 h-3" /> Feedback submitted
                </p>
            )}
            {responses && responses.length > 0 && (
                <div className="space-y-1 max-h-50 overflow-y-auto">
                    <p className="text-[9px] font-mono uppercase text-muted-foreground font-bold">
                        {responses.length} response{responses.length !== 1 ? "s" : ""}
                    </p>
                    {responses.map((r: any, i: number) => (
                        <div key={i} className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs text-foreground">
                            {r.textResponse}
                            {!poll.isAnonymous && r.userName && (
                                <span className="text-[9px] text-muted-foreground ml-1.5">— {r.userName}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Multiple Choice ───
function MultipleChoiceDisplay({ poll }: { poll: PollData }) {
    const votePoll = useMutation(api.polls.votePoll);
    const [selected, setSelected] = useState<number[]>([]);
    const [isVoting, setIsVoting] = useState(false);
    const totalVotes = poll.options.reduce((acc, opt) => acc + opt.count, 0);
    const hasVoted = poll.userVote !== undefined || (poll.userVoteIndices !== undefined && poll.userVoteIndices.length > 0);
    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;
    const isClosed = !poll.isActive || isExpired;

    const handleVote = async () => {
        if (selected.length === 0) { toast.error("Select at least one option"); return; }
        setIsVoting(true);
        try {
            const result = await votePoll({ pollId: poll._id, optionIndices: selected });
            if (result?.alreadyVoted) { toast.error("You've already voted"); return; }
            toast.success("Votes recorded!");
        } catch (e: any) {
            toast.error(e.message || "Failed to vote");
        } finally { setIsVoting(false); }
    };

    if (hasVoted || isClosed) {
        return (
            <div className="space-y-1.5">
                {poll.options.map((option, index) => {
                    const percentage = totalVotes > 0 ? Math.round((option.count / totalVotes) * 100) : 0;
                    const isWinner = isClosed && totalVotes > 0 && option.count === Math.max(...poll.options.map(o => o.count));
                    return (
                        <div key={index} className="relative">
                            <div className={cn(
                                "relative h-9 w-full bg-background border overflow-hidden rounded-lg",
                                isWinner ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-border"
                            )}>
                                <div className={cn("absolute inset-y-0 left-0 transition-all duration-700 rounded-l-lg", isWinner ? "bg-emerald-500/10" : "bg-muted/50")}
                                    style={{ width: `${percentage}%` }} />
                                <div className="absolute inset-0 flex items-center justify-between px-3">
                                    <span className={cn("text-xs font-medium", isWinner && "text-emerald-400")}>
                                        {option.label} {isWinner && "🏆"}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground/50">{option.count}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold">{percentage}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {poll.options.map((option, index) => {
                const isSelected = selected.includes(index);
                return (
                    <button
                        key={index}
                        className={cn(
                            "w-full h-9 px-3 text-left text-xs font-medium bg-background border transition-all flex items-center gap-2 rounded-lg",
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/50 hover:bg-primary/5"
                        )}
                        onClick={() => setSelected(prev => isSelected ? prev.filter(i => i !== index) : [...prev, index])}
                        disabled={isVoting}
                    >
                        <CheckSquare className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground/30")} />
                        <span>{option.label}</span>
                    </button>
                );
            })}
            <Button size="sm" className="w-full h-7 text-[10px] font-mono uppercase mt-1" onClick={handleVote} disabled={isVoting || selected.length === 0}>
                {isVoting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Submit ({selected.length} selected)
            </Button>
        </div>
    );
}

// ─── Main PollCard ───
export function PollCard({ poll }: { poll: PollData }) {
    const votePoll = useMutation(api.polls.votePoll);
    const retractVote = useMutation(api.polls.retractVote);
    const [isVoting, setIsVoting] = useState<number | null>(null);
    const [isRetracting, setIsRetracting] = useState(false);

    const pollType = poll.pollType || "single_choice";
    const totalVotes = poll.options.reduce((acc, opt) => acc + opt.count, 0);
    const voterCount = poll.totalVoterCount ?? totalVotes;
    const hasVoted = poll.userVote !== undefined || (poll.userVoteIndices !== undefined && poll.userVoteIndices.length > 0);
    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;
    const isClosed = !poll.isActive || isExpired;

    const typeLabel = {
        single_choice: "Poll",
        multiple_choice: "Multi-Select",
        yes_no: "Yes / No",
        rating: "Rating",
        feedback: "Feedback",
    }[pollType] || "Poll";

    const typeIcon = {
        single_choice: <BarChart2 className="w-3.5 h-3.5 text-primary" />,
        multiple_choice: <CheckSquare className="w-3.5 h-3.5 text-primary" />,
        yes_no: <ThumbsUp className="w-3.5 h-3.5 text-primary" />,
        rating: <Star className="w-3.5 h-3.5 text-amber-400" />,
        feedback: <MessageSquareText className="w-3.5 h-3.5 text-blue-500" />,
    }[pollType] || <BarChart2 className="w-3.5 h-3.5 text-primary" />;

    const handleVote = async (optionIndex: number) => {
        if (hasVoted || isClosed) return;
        setIsVoting(optionIndex);
        try {
            const result = await votePoll({ pollId: poll._id, optionIndex });
            if (result?.alreadyVoted) { toast.error("You've already voted"); return; }
            toast.success("Vote recorded!");
        } catch (error: any) {
            toast.error(error.message || "Failed to vote");
        } finally { setIsVoting(null); }
    };

    const handleRetract = async () => {
        setIsRetracting(true);
        try {
            await retractVote({ pollId: poll._id });
            toast.success("Vote retracted — you can vote again");
        } catch (error: any) {
            toast.error(error.message || "Failed to retract");
        } finally { setIsRetracting(false); }
    };

    return (
        <div className="w-full max-w-sm mt-1.5 mb-0.5">
            <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        {typeIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-foreground leading-snug">{poll.question}</h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" /> {voterCount} vote{voterCount !== 1 ? "s" : ""}
                            </span>
                            {isClosed && (
                                <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="text-[10px] text-muted-foreground font-semibold">Final</span>
                                </>
                            )}
                            {poll.isAnonymous && (
                                <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="text-[10px] text-muted-foreground">Anonymous</span>
                                </>
                            )}
                            {poll.expiresAt && !isClosed && (
                                <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        <ExpiryCountdown expiresAt={poll.expiresAt} />
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Type-specific rendering */}
                {pollType === "rating" ? (
                    <RatingDisplay poll={poll} onVote={handleVote} isVoting={isVoting} />
                ) : pollType === "feedback" ? (
                    <FeedbackDisplay poll={poll} />
                ) : pollType === "multiple_choice" ? (
                    <MultipleChoiceDisplay poll={poll} />
                ) : (
                    /* Single choice / Yes-No */
                    <div className="space-y-1.5">
                        {poll.options.map((option, index) => {
                            const percentage = totalVotes > 0 ? Math.round((option.count / totalVotes) * 100) : 0;
                            const isWinner = isClosed && totalVotes > 0 && option.count === Math.max(...poll.options.map(o => o.count));
                            const isUserChoice = poll.userVote === index;

                            if (hasVoted || isClosed) {
                                return (
                                    <div key={index} className="relative">
                                        <div className={cn(
                                            "relative h-9 w-full bg-background border overflow-hidden rounded-lg",
                                            isUserChoice ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
                                            isWinner && "border-emerald-500/40 ring-1 ring-emerald-500/20"
                                        )}>
                                            <div
                                                className={cn(
                                                    "absolute inset-y-0 left-0 transition-all duration-700 rounded-l-lg",
                                                    isUserChoice ? "bg-primary/15" : "bg-muted/50",
                                                    isWinner && "bg-emerald-500/10"
                                                )}
                                                style={{ width: `${percentage}%` }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-between px-3">
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    isUserChoice && "text-primary",
                                                    isWinner && "text-emerald-400"
                                                )}>
                                                    {pollType === "yes_no" && index === 0 ? "👍 " : pollType === "yes_no" && index === 1 ? "👎 " : ""}
                                                    {option.label} {isUserChoice && "✓"} {isWinner && "🏆"}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-muted-foreground/50">{option.count}</span>
                                                    <span className="text-[10px] text-muted-foreground font-bold">{percentage}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={index}
                                    className={cn(
                                        "w-full h-9 px-3 text-left text-xs font-medium bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between",
                                        pollType === "yes_no" && index === 0 && "hover:border-emerald-500/50 hover:bg-emerald-500/5",
                                        pollType === "yes_no" && index === 1 && "hover:border-red-500/50 hover:bg-red-500/5",
                                    )}
                                    onClick={() => handleVote(index)}
                                    disabled={isVoting !== null}
                                >
                                    <span>
                                        {pollType === "yes_no" && index === 0 ? "👍 " : pollType === "yes_no" && index === 1 ? "👎 " : ""}
                                        {option.label}
                                    </span>
                                    {isVoting === index && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Voter Avatars + Retract Vote */}
                <div className="flex items-center justify-between pt-1">
                    {/* Recent voters */}
                    {!poll.isAnonymous && poll.recentVoters && poll.recentVoters.length > 0 && (
                        <div className="flex items-center gap-1">
                            <div className="flex -space-x-1.5">
                                {poll.recentVoters.slice(0, 5).map((v, i) => (
                                    <div key={i} className="w-5 h-5 rounded-full bg-primary/10 border border-background flex items-center justify-center">
                                        <span className="text-[7px] font-bold text-primary">{v.name.substring(0, 2).toUpperCase()}</span>
                                    </div>
                                ))}
                            </div>
                            {voterCount > 5 && (
                                <span className="text-[9px] text-muted-foreground ml-1">+{voterCount - 5}</span>
                            )}
                        </div>
                    )}

                    {/* Retract vote button */}
                    {hasVoted && !isClosed && pollType !== "feedback" && (
                        <button
                            onClick={handleRetract}
                            disabled={isRetracting}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
                        >
                            {isRetracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                            Change vote
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

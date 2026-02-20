"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, BarChart2, Loader2, Star, MessageSquareText, ThumbsUp, CheckSquare, List } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CreatePollDialogProps {
    channelId: Id<"channels">;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type PollType = "single_choice" | "multiple_choice" | "yes_no" | "rating" | "feedback";

const POLL_TYPES: { value: PollType; label: string; icon: React.ReactNode; description: string }[] = [
    { value: "single_choice", label: "Single Choice", icon: <List className="w-4 h-4" />, description: "Pick one option" },
    { value: "multiple_choice", label: "Multi Select", icon: <CheckSquare className="w-4 h-4" />, description: "Select multiple" },
    { value: "yes_no", label: "Yes / No", icon: <ThumbsUp className="w-4 h-4" />, description: "Simple binary" },
    { value: "rating", label: "Rating (1–5)", icon: <Star className="w-4 h-4" />, description: "Star rating scale" },
    { value: "feedback", label: "Open Feedback", icon: <MessageSquareText className="w-4 h-4" />, description: "Free text responses" },
];

export function CreatePollDialog({ channelId, trigger, open, onOpenChange }: CreatePollDialogProps) {
    const createPoll = useMutation(api.polls.createPoll);
    const [pollType, setPollType] = useState<PollType>("single_choice");
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [expiryDays, setExpiryDays] = useState(3);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = open !== undefined && onOpenChange !== undefined;
    const finalOpen = isControlled ? open : internalOpen;
    const setFinalOpen = isControlled ? onOpenChange : setInternalOpen;

    const needsOptions = pollType === "single_choice" || pollType === "multiple_choice";

    const handleAddOption = () => {
        if (options.length < 10) {
            setOptions([...options, ""]);
        }
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const resetForm = () => {
        setPollType("single_choice");
        setQuestion("");
        setOptions(["", ""]);
        setIsAnonymous(false);
        setExpiryDays(3);
    };

    const handleSubmit = async () => {
        if (!question.trim()) {
            toast.error("Please enter a question");
            return;
        }

        if (needsOptions) {
            const validOptions = options.filter(o => o.trim());
            if (validOptions.length < 2) {
                toast.error("Please provide at least 2 options");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await createPoll({
                channelId,
                question: question.trim(),
                pollType,
                options: needsOptions ? options.filter(o => o.trim()) : [],
                isAnonymous,
                expiresInMinutes: expiryDays * 24 * 60,
            });
            toast.success(pollType === "feedback" ? "Feedback form created!" : "Poll created!");
            setFinalOpen(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || "Failed to create poll");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={finalOpen} onOpenChange={(o) => { setFinalOpen(o); if (!o) resetForm(); }}>
            <DialogContent className="sm:max-w-[480px] gap-0 p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-3">
                    <DialogTitle className="font-mono text-sm uppercase tracking-tight flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-primary" />
                        {pollType === "feedback" ? "Create Feedback Form" : "Create Poll"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Ask the community for their opinion or collect feedback.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-5 pb-5 space-y-4">
                    {/* Poll Type Selector */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                        <div className="grid grid-cols-5 gap-1.5">
                            {POLL_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => setPollType(type.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 p-2 rounded-md border text-center transition-all",
                                        pollType === type.value
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                                    )}
                                >
                                    {type.icon}
                                    <span className="text-[8px] font-mono uppercase leading-tight">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                            {pollType === "feedback" ? "Feedback Question" : "Poll Question"}
                        </Label>
                        <Textarea
                            placeholder={
                                pollType === "feedback"
                                    ? "How was the event? What can we improve?"
                                    : pollType === "rating"
                                        ? "Rate our last community meetup"
                                        : pollType === "yes_no"
                                            ? "Should we organize a weekend cleanup?"
                                            : "What should we do about..."
                            }
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="resize-none min-h-15 text-sm"
                        />
                    </div>

                    {/* Options (only for single/multiple choice) */}
                    {needsOptions && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                                Options {pollType === "multiple_choice" && <Badge variant="outline" className="ml-1 text-[7px] font-mono">Multi-Select</Badge>}
                            </Label>
                            <div className="space-y-1.5">
                                {options.map((option, index) => (
                                    <div key={index} className="flex gap-1.5">
                                        <div className="w-5 h-8 flex items-center justify-center text-[10px] font-mono text-muted-foreground shrink-0">
                                            {pollType === "multiple_choice" ? (
                                                <CheckSquare className="w-3 h-3" />
                                            ) : (
                                                <div className="w-3 h-3 rounded-full border border-muted-foreground/40" />
                                            )}
                                        </div>
                                        <Input
                                            placeholder={`Option ${index + 1}`}
                                            value={option}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                        {options.length > 2 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveOption(index)}
                                                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-red-500"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {options.length < 10 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-1 border-dashed h-8 text-xs"
                                    onClick={handleAddOption}
                                >
                                    <Plus className="w-3 h-3 mr-1.5" />
                                    Add Option
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Rating Preview */}
                    {pollType === "rating" && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Scale Preview</Label>
                            <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-md border border-border">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <div key={n} className="flex flex-col items-center gap-1">
                                        <Star className={cn("w-6 h-6 transition-colors", n <= 3 ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
                                        <span className="text-[9px] font-mono text-muted-foreground">{n}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Yes/No Preview */}
                    {pollType === "yes_no" && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Options</Label>
                            <div className="flex gap-2">
                                <div className="flex-1 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-center text-sm font-medium text-emerald-600">
                                    👍 Yes
                                </div>
                                <div className="flex-1 p-2.5 bg-red-500/10 border border-red-500/20 rounded-md text-center text-sm font-medium text-red-500">
                                    👎 No
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Feedback hint */}
                    {pollType === "feedback" && (
                        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-md">
                            <p className="text-[10px] font-mono uppercase text-blue-500">
                                Members will submit open text responses. {isAnonymous ? "Responses will be anonymous." : "Names will be visible."}
                            </p>
                        </div>
                    )}

                    {/* Settings Row */}
                    <div className="flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAnonymous}
                                onChange={(e) => setIsAnonymous(e.target.checked)}
                                className="w-3.5 h-3.5 rounded"
                            />
                            <span className="text-[10px] font-mono uppercase text-muted-foreground">Anonymous</span>
                        </label>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono uppercase text-muted-foreground">Expires in</span>
                            <select
                                value={expiryDays}
                                onChange={(e) => setExpiryDays(Number(e.target.value))}
                                className="h-6 text-[10px] font-mono bg-muted border border-border rounded px-1.5"
                            >
                                <option value={1}>1 day</option>
                                <option value={3}>3 days</option>
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                            </select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-5 py-3 bg-muted/30 border-t border-border">
                    <Button variant="ghost" size="sm" className="text-xs font-mono uppercase" onClick={() => { setFinalOpen(false); resetForm(); }} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button size="sm" className="text-xs font-mono uppercase gap-1.5" onClick={handleSubmit} disabled={isSubmitting || !question.trim()}>
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {pollType === "feedback" ? "Create Form" : "Create Poll"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

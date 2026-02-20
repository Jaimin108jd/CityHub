"use client";

import { Id } from "@/convex/_generated/dataModel";
import {
    Send, Paperclip, X, Smile, Mic, StopCircle,
    FileText, Plus, Play, Pause, Reply, Trash2, Loader2,
    BarChart2, ImageIcon, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { memo, useState, useEffect } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AudioPlayer } from "../AudioPlayer";
import { CreatePollDialog } from "../CreatePollDialog";
import { useMediaQuery } from "@/hooks/use-media-query";

interface MobileMessageInputProps {
    channelId: Id<"channels">;
    channelName: string;
    isManagerOnly: boolean;
    canManage: boolean;
    replyingTo: any | null;
    editingMessage: { id: Id<"messages">; content: string } | null;
    newMessage: string;
    selectedFile: File | null;
    uploadPreview: string | null;
    isSending: boolean;
    isUploading: boolean;
    audioBlob: Blob | null;
    audioUrl: string | null;
    isRecording: boolean;
    isPaused: boolean;
    recordingDuration: number;
    memberList: { userId: string; name: string }[];
    showMentions: boolean;
    filteredMembers: { userId: string; name: string }[];
    mentionIndex: number;
    onMessageChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onSend: () => void;
    onCancelReplyEdit: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveFile: () => void;
    onStartRecording: () => void;
    onTogglePause: () => void;
    onStopRecording: () => void;
    onCancelRecording: () => void;
    onSendVoice: (blob: Blob) => void;
    onInsertMention: (member: { userId: string; name: string }) => void;
    onEmojiClick: (emoji: string) => void;
    inputRef: React.RefObject<HTMLTextAreaElement>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    timeoutUntil: number | null;
}

function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const MobileMessageInput = memo(function MobileMessageInput({
    channelId, channelName, isManagerOnly, canManage,
    replyingTo, editingMessage, newMessage, selectedFile,
    uploadPreview, isSending, isUploading, audioBlob, audioUrl,
    isRecording, isPaused, recordingDuration,
    showMentions, filteredMembers, mentionIndex,
    onMessageChange, onKeyDown, onSend, onCancelReplyEdit,
    onFileSelect, onRemoveFile, onStartRecording, onTogglePause,
    onStopRecording, onCancelRecording, onSendVoice, onInsertMention,
    onEmojiClick, inputRef, fileInputRef, timeoutUntil,
}: MobileMessageInputProps) {
    const disabled = isManagerOnly && !canManage;
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [showPollDialog, setShowPollDialog] = useState(false);

    // ─── Live timeout countdown ───
    const [timeoutRemaining, setTimeoutRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (!timeoutUntil) { setTimeoutRemaining(null); return; }

        const tick = () => {
            const diff = timeoutUntil - Date.now();
            if (diff <= 0) { setTimeoutRemaining(null); return; }
            setTimeoutRemaining(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [timeoutUntil]);

    const isTimedOut = timeoutRemaining !== null && timeoutRemaining > 0;

    const formatCountdown = (ms: number) => {
        const totalSecs = Math.ceil(ms / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };
    return (
        <div
            className={cn(
                "z-10 bg-background/80 backdrop-blur-xl border-t border-border/60 shrink-0",
                isMobile ? "fixed bottom-14 w-full" : ""
            )}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
        >
            {/* ─── Timeout Banner (Discord-style) ─── */}
            {isTimedOut && (
                <div className="px-3 py-3">
                    <div className="flex items-center gap-3 bg-destructive/8 border border-destructive/20 rounded-2xl px-4 py-3">
                        <div className="w-8 h-8 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground/90">You are timed out</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                You can send messages again in{" "}
                                <span className="font-mono font-bold text-destructive tabular-nums">
                                    {formatCountdown(timeoutRemaining!)}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Mention Autocomplete ─── */}
            {!isTimedOut && showMentions && filteredMembers.length > 0 && (
                <div className="mx-3 mb-0 bg-card border border-border rounded-t-2xl shadow-lg overflow-hidden">
                    {filteredMembers.map((member, i) => (
                        <button
                            key={member.userId}
                            onClick={() => onInsertMention(member)}
                            className={cn(
                                "w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors border-b border-border/50 last:border-0",
                                i === mentionIndex ? "bg-primary/8 text-primary" : "text-foreground hover:bg-muted/60"
                            )}
                        >
                            <span className="text-primary/60 font-semibold text-xs">@</span>
                            <span className="font-medium">{member.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ─── Reply / Edit Banner ─── */}
            {!isTimedOut && (replyingTo || editingMessage) && (
                <div className="flex items-center gap-2.5 bg-muted/40 px-4 py-2 border-b border-border/50">
                    <div className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-lg shrink-0",
                        editingMessage ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                    )}>
                        {editingMessage ? <FileText className="w-3.5 h-3.5" /> : <Reply className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                            {editingMessage ? "Editing message" : `Replying to ${replyingTo?.author?.name || "Unknown"}`}
                        </p>
                        {!editingMessage && replyingTo?.content && (
                            <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
                        )}
                    </div>
                    <button onClick={onCancelReplyEdit} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ─── File Preview ─── */}
            {!isTimedOut && selectedFile && !isSending && (
                <div className="px-4 pt-3">
                    {uploadPreview ? (
                        <div className="relative inline-block">
                            <img src={uploadPreview} alt="Preview"
                                className="h-20 rounded-2xl border border-border/60 object-cover shadow-sm" />
                            <button onClick={onRemoveFile}
                                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-md">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-xl border border-border/50 w-fit max-w-55">
                            <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs text-foreground truncate">{selectedFile.name}</span>
                            <button onClick={onRemoveFile} className="hover:text-destructive transition-colors">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Voice Preview (after recording) ─── */}
            {!isTimedOut && audioUrl && !isRecording && (
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-2xl p-2">
                        {/* AudioPlayer for preview */}
                        <div className="flex-1 min-w-0">
                            <AudioPlayer src={audioUrl} variant="review" />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                            <button
                                onClick={onCancelRecording}
                                disabled={isSending || isUploading}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onSendVoice(audioBlob!)}
                                disabled={isSending || isUploading}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {isUploading
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Main Input Bar ─── */}
            {!isTimedOut && !audioUrl && (
                <div className="px-3 py-2 flex items-end gap-2 ">
                    {/* Plus / Attach */}
                    {!isRecording && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    disabled={disabled}
                                    className="w-9 h-9 flex items-center justify-center rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5 disabled:opacity-40"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="top" className="w-44 rounded-2xl shadow-lg">
                                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="rounded-xl cursor-pointer gap-2">
                                    <ImageIcon className="w-4 h-4" /> Upload File
                                </DropdownMenuItem>
                                {!isManagerOnly && (
                                    <DropdownMenuItem onClick={() => setShowPollDialog(true)} className="rounded-xl cursor-pointer gap-2">
                                        <BarChart2 className="w-4 h-4" /> Create Poll
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Input Pill */}
                    <div className="flex-1 flex items-end bg-muted/60 border border-border/60 rounded-3xl px-3.5 py-2 gap-2 focus-within:border-primary/30 focus-within:bg-muted/80 transition-all min-h-[40px]">
                        {isRecording ? (
                            <div className="flex-1 flex items-center gap-3 h-6">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                                    <span className="text-destructive text-sm font-mono font-bold tabular-nums">
                                        {formatDuration(recordingDuration)}
                                    </span>
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {isPaused ? "Paused" : "Recording..."}
                                </span>
                            </div>
                        ) : (
                            <textarea
                                ref={inputRef}
                                rows={1}
                                placeholder={disabled ? "Only managers can post..." : `Message #${channelName}`}
                                value={newMessage}
                                onChange={onMessageChange}
                                onKeyDown={onKeyDown}
                                disabled={disabled || isSending}
                                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none resize-none text-[15px] leading-relaxed py-0 scrollbar-none disabled:opacity-50"
                                style={{ height: '24px', minHeight: '24px', maxHeight: '120px' }}
                            />
                        )}

                        {/* Emoji picker */}
                        {!isRecording && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button disabled={disabled} className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0">
                                        <Smile className="w-5 h-5" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent side="top" align="end" className="w-auto p-0 border-none bg-transparent shadow-none mb-2">
                                    <EmojiPicker theme={"auto" as any} onEmojiClick={(d: EmojiClickData) => onEmojiClick(d.emoji)} />
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>

                    {/* Right action */}
                    <div className="flex items-center gap-1 shrink-0 mb-0.5">
                        {isRecording ? (
                            <>
                                <button onClick={onTogglePause}
                                    className="w-9 h-9 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                    {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                                </button>
                                <button onClick={onStopRecording}
                                    className="w-9 h-9 flex items-center justify-center rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                    <StopCircle className="w-5 h-5" />
                                </button>
                                <button onClick={onCancelRecording}
                                    className="w-9 h-9 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-destructive transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </>
                        ) : (newMessage.trim() || selectedFile) ? (
                            <button
                                onClick={onSend}
                                disabled={isSending || isUploading || disabled}
                                className={cn(
                                    "w-9 h-9 flex items-center justify-center rounded-2xl transition-all disabled:opacity-50",
                                    editingMessage
                                        ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                )}
                            >
                                {isSending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />
                                }
                            </button>
                        ) : (
                            <button
                                onClick={onStartRecording}
                                disabled={disabled}
                                className="w-9 h-9 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <CreatePollDialog
                channelId={channelId}
                open={showPollDialog}
                onOpenChange={setShowPollDialog}
            />

            <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
        </div>
    );
});

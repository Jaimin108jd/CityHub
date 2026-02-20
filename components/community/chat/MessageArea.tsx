"use client";

import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Download, Loader2, Smile, Reply, FileText, Trash2, MessagesSquare, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioPlayer } from "./AudioPlayer";
import { PollCard } from "./PollCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHoverCard } from "../UserHoverCard";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

import { useVirtualizer } from "@tanstack/react-virtual";
import { debounce } from "lodash";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MobileMessageInput } from "./mobile/messageInput";
import { UploadProgressBar, UploadState } from "./uploadProgress";
import { CatchMeUpButton } from "./CatchMeUpButton";
import { FlaggedMessageOverlay } from "./FlaggedMessageOverlay";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface MessageAreaProps {
    channelId: Id<"channels">;
    groupId: Id<"groups">;
    channelName: string;
    isManagerOnly: boolean;
    isMuted?: boolean;
    onToggleMute?: () => void;
    canManage?: boolean;
    highlightMessageId?: Id<"messages"> | null;
    onHighlightDone?: () => void;
}

// ─── Helpers ───
function parseMentions(content: string, members: { userId: string; name: string }[]) {
    const mentionRegex = /@([^\s@]+)/g;
    const foundMentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        const mentionedName = match[1].toLowerCase();
        const member = members.find(m =>
            m.name.toLowerCase().replace(/\s+/g, '') === mentionedName ||
            m.name.toLowerCase().startsWith(mentionedName)
        );
        if (member && !foundMentions.includes(member.userId)) foundMentions.push(member.userId);
    }
    return { content, mentions: foundMentions };
}

function renderContentWithMentions(content: string, members: { userId: string; name: string }[]) {
    const parts: (string | { name: string; userId: string })[] = [];
    const mentionRegex = /@([^\s@]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        if (lastIndex < match.index) parts.push(content.slice(lastIndex, match.index));
        const mentionedName = match[1];
        const member = members.find(m =>
            m.name.toLowerCase().replace(/\s+/g, '').startsWith(mentionedName.toLowerCase().replace(/\s+/g, ''))
        );
        if (member) parts.push({ name: member.name, userId: member.userId });
        else parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return parts;
}

// ─── Simulate upload progress (since Fetch API doesn't expose upload progress easily) ───
function useSimulatedProgress(isUploading: boolean) {
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isUploading) {
            setProgress(5);
            // Simulate fast start, slow finish (actual upload finishes it)
            intervalRef.current = setInterval(() => {
                setProgress(p => {
                    if (p >= 85) { clearInterval(intervalRef.current!); return p; }
                    // Slow down as we approach 85%
                    const step = p < 40 ? 8 : p < 65 ? 4 : 1.5;
                    return Math.min(p + step, 85);
                });
            }, 120);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (progress > 0) setProgress(100); // jump to 100 on completion
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isUploading]);

    // Reset after completion
    useEffect(() => {
        if (progress === 100) {
            const t = setTimeout(() => setProgress(0), 2500);
            return () => clearTimeout(t);
        }
    }, [progress]);

    return progress;
}

// ─── Message Row ───
const MessageRow = memo(({
    msg, prevMsg, me, memberMap, memberList,
    reactions, onToggleReaction, onDelete, onReply, onEdit,
    onExpandImage, isDeleting, isHighlighted, onLongPress,
}: {
    msg: any; prevMsg: any; me: any;
    memberMap: Map<string, any>; memberList: { userId: string; name: string }[];
    reactions: any[];
    onToggleReaction: (id: Id<"messages">, emoji: string) => void;
    onDelete: (id: Id<"messages">) => void;
    onReply: (msg: any) => void;
    onEdit: (msg: any) => void;
    onExpandImage: (url: string) => void;
    isDeleting: boolean;
    isHighlighted?: boolean;
    onLongPress?: (msg: any) => void;
}) => {
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const didLongPress = useRef(false);

    const handleTouchStart = useCallback(() => {
        didLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
            onLongPress?.(msg);
        }, 500);
    }, [msg, onLongPress]);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }, []);

    const handleTouchMove = useCallback(() => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }, []);

    const isSameUser = prevMsg && prevMsg.userId === msg.userId;
    const isNearTime = prevMsg && (msg.createdAt - prevMsg.createdAt < 5 * 60 * 1000);
    const grouped = isSameUser && isNearTime && prevMsg?.type !== "system";
    const memberData = memberMap.get(msg.userId);
    const isMention = msg.mentions?.includes(me?.userId);
    const isOwnMessage = msg.userId === me?.userId;

    const parts = useMemo(() =>
        msg.content?.includes('@') ? renderContentWithMentions(msg.content, memberList) : [msg.content],
        [msg.content, memberList]
    );

    const nameColor = memberData?.role === 'founder'
        ? 'text-amber-600 dark:text-amber-400'
        : memberData?.role === 'manager' ? 'text-primary' : 'text-foreground';

    return (
        <div
            className={cn(
                "group relative flex pl-3 pr-4 py-0.5 hover:bg-muted/30 transition-colors w-full select-none",
                grouped ? "mt-0" : "mt-4",
                isMention && "bg-amber-500/8 hover:bg-amber-500/12 shadow-[inset_2px_0_0_0_var(--color-amber-400)]",
                msg.isPending && "opacity-60",
                isHighlighted && "ring-2 ring-primary/50 bg-primary/10 animate-pulse rounded-lg"
            )}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => { if (onLongPress) e.preventDefault(); }}
        >
            {/* Hover Toolbar — desktop only */}
            <div className="absolute right-2 -top-3 z-10 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity
                bg-card border border-border shadow-md rounded-xl overflow-hidden p-0.5 items-center gap-0.5">
                <button onClick={() => onReply(msg)}
                    className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                    <Reply className="w-3.5 h-3.5" />
                </button>
                {isOwnMessage && msg.type === "text" && (
                    <button onClick={() => onEdit(msg)}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                    </button>
                )}
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                            <Smile className="w-3.5 h-3.5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-auto p-0 border-none bg-transparent shadow-none mb-2">
                        <EmojiPicker theme={"auto" as any} onEmojiClick={(e) => onToggleReaction(msg._id, e.emoji)} />
                    </PopoverContent>
                </Popover>
                {isOwnMessage && (
                    <button onClick={() => onDelete(msg._id)} disabled={isDeleting}
                        className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors">
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>

            {/* Avatar */}
            <div className="w-10 shrink-0">
                {!grouped ? (
                    <UserHoverCard userId={msg.userId} name={msg.author?.name || "Unknown"}
                        avatarUrl={msg.author?.avatarUrl} role={memberData?.role}
                        joinedAt={memberData?.joinedAt} bio={memberData?.bio} city={memberData?.city}>
                        <Avatar className="w-9 h-9 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity border border-border/50">
                            {msg.author?.avatarUrl && <AvatarImage src={msg.author.avatarUrl} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                {msg.author?.name?.substring(0, 2).toUpperCase() ?? "??"}
                            </AvatarFallback>
                        </Avatar>
                    </UserHoverCard>
                ) : (
                    <span className="text-[10px] text-transparent group-hover:text-muted-foreground/40 block text-right pt-1 pr-1 select-none tabular-nums">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pl-2.5">
                {!grouped && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                        <UserHoverCard userId={msg.userId} name={msg.author?.name || "Unknown"}
                            avatarUrl={msg.author?.avatarUrl} role={memberData?.role}
                            joinedAt={memberData?.joinedAt} bio={memberData?.bio} city={memberData?.city}>
                            <span className={cn("font-semibold text-sm cursor-pointer hover:underline underline-offset-2", nameColor)}>
                                {msg.author?.name || "Unknown User"}
                            </span>
                        </UserHoverCard>
                        <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                            {new Date(msg.createdAt).toLocaleDateString() === new Date().toLocaleDateString()
                                ? `Today at ${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : new Date(msg.createdAt).toLocaleDateString()
                            }
                        </span>
                    </div>
                )}

                {/* Reply Context */}
                {msg.parentMessage && (
                    <div className="flex items-center gap-2 mb-1.5 border-l-2 border-primary/30 pl-2 py-0.5 bg-muted/30 rounded-r-lg w-fit max-w-65">
                        <span className="text-xs font-semibold text-primary/80">@{msg.parentMessage.author?.name}</span>
                        <span className="text-xs text-muted-foreground truncate opacity-70">{msg.parentMessage.content || "Attachment"}</span>
                    </div>
                )}

                {/* Moderation Flag — wraps body when hidden so reveal works */}
                {msg.moderationFlag && (
                    <FlaggedMessageOverlay
                        moderationFlag={msg.moderationFlag}
                        content={msg.content}
                        isManager={memberData?.role === 'manager' || memberData?.role === 'founder'}
                    >
                        <div className="text-[15px] leading-relaxed text-foreground/90 font-light opacity-60">
                            {msg.type === "text" && msg.content && (
                                <p className="whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                            )}
                        </div>
                    </FlaggedMessageOverlay>
                )}

                {/* Message Body — normal display when not flagged */}
                <div className={cn(
                    "text-[15px] leading-relaxed text-foreground/90 font-light",
                    msg.moderationFlag && (msg.moderationFlag.status === 'auto_hidden' || msg.moderationFlag.status === 'confirmed_hidden' || msg.moderationFlag.status === 'automod_blocked')
                        ? 'hidden' : ''
                )}>
                    {msg.type === "text" && msg.content && (
                        <p className="whitespace-pre-wrap wrap-break-word">
                            {parts.map((part: any, i: number) =>
                                typeof part === 'string' ? <span key={i}>{part}</span> : (
                                    <span key={i} className="inline-flex items-center px-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium cursor-pointer text-sm">
                                        @{part.name.split(' ')[0]}
                                    </span>
                                )
                            )}
                            {msg.editedAt && <span className="text-[10px] text-muted-foreground/50 ml-1.5 italic">(edited)</span>}
                        </p>
                    )}

                    {msg.type === "image" && msg.fileUrl && (
                        <div className="mt-1">
                            <div className="overflow-hidden rounded-2xl w-fit max-w-70 cursor-pointer bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors"
                                style={{ aspectRatio: msg.isPending ? '16/9' : 'auto', minHeight: msg.isPending ? '160px' : 'auto' }}
                                onClick={() => onExpandImage(msg.fileUrl)}>
                                <img src={msg.fileUrl} alt="Shared image" className="max-w-full h-auto object-cover max-h-70" loading="lazy" />
                            </div>
                            {msg.content && <p className="pt-1 text-sm text-muted-foreground">{msg.content}</p>}
                        </div>
                    )}

                    {msg.type === "file" && msg.fileUrl && (
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-3 p-3 border border-border/60 bg-card hover:bg-muted/50 transition-colors max-w-70 rounded-2xl group/file">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                                <Paperclip className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{msg.content || "Attachment"}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : "File"}
                                </p>
                            </div>
                            <Download className="w-4 h-4 text-muted-foreground group-hover/file:text-primary transition-colors" />
                        </a>
                    )}

                    {msg.type === "voice" && msg.fileUrl && (
                        <div className="mt-0.5">
                            <AudioPlayer
                                src={msg.fileUrl}
                                variant="received"
                                transcription={msg.transcription}
                                transcriptionStatus={msg.transcriptionStatus}
                            />
                        </div>
                    )}

                    {msg.type === "poll" && msg.poll && (
                        <div className="mt-1 max-w-80">
                            <PollCard poll={msg.poll} />
                        </div>
                    )}

                    {/* Reactions */}
                    {reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {reactions.map((r: any, i: number) => {
                                const hasReacted = r.users.includes(me?.userId);
                                return (
                                    <button key={i} onClick={() => onToggleReaction(msg._id, r.emoji)}
                                        className={cn(
                                            "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-all",
                                            hasReacted
                                                ? "bg-primary/15 border-primary/40 text-primary"
                                                : "bg-muted/60 border-border/60 text-muted-foreground hover:bg-muted hover:border-border"
                                        )}>
                                        <span>{r.emoji}</span>
                                        <span className="tabular-nums">{r.users.length}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
MessageRow.displayName = "MessageRow";

const MessageRowWrapper = memo(({ msg, optimisticReactions, isHighlighted, onLongPress, ...props }: any) => {
    const reactions = useMemo(() => optimisticReactions[msg._id] || msg.reactions || [], [optimisticReactions[msg._id], msg.reactions]);
    return <MessageRow {...props} msg={msg} reactions={reactions} isHighlighted={isHighlighted} onLongPress={onLongPress} />;
});
MessageRowWrapper.displayName = "MessageRowWrapper";


// ─── Main MessageArea ───
export function MessageArea({
    channelId, groupId, channelName, isManagerOnly,
    isMuted = false, onToggleMute, canManage = false,
    highlightMessageId = null, onHighlightDone,
}: MessageAreaProps) {
    const { results: messages, status, loadMore } = usePaginatedQuery(api.messages.listMessages, { channelId }, { initialNumItems: 50 });
    const members = useQuery(api.groups.getGroupMembers, { groupId });
    const me = useQuery(api.users.getMyProfile);
    const typingUsers = useQuery(api.messages.getTypingUsers, { channelId });
    const myTimeout = useQuery(api.messages.getMyTimeout, { groupId });

    const sendMessage = useMutation(api.messages.sendMessage).withOptimisticUpdate((localStore, args) => {
        const { channelId, content, type, parentMessageId, clientSideId, mentions, pollId, fileId } = args;
        // Match the initial pagination options from usePaginatedQuery
        const paginationOpts = { numItems: 50, cursor: null };
        const existingMessages = localStore.getQuery(api.messages.listMessages, { channelId, paginationOpts });

        if (existingMessages && me) {
            const optimisticMsg: any = {
                _id: (clientSideId || `temp-${Date.now()}`) as Id<"messages">,
                channelId,
                groupId,
                userId: me.userId,
                content,
                type,
                createdAt: Date.now(),
                reactions: [],
                isPending: true,
                clientSideId,
                mentions,
                pollId,
                fileId,
                author: { name: me.name, avatarUrl: me.imageUrl },
                parentMessage: null,
            };

            const newPage = [optimisticMsg, ...existingMessages.page];
            localStore.setQuery(api.messages.listMessages, { channelId, paginationOpts }, {
                ...existingMessages,
                page: newPage,
            });
        }
    });

    const deleteMessage = useMutation(api.messages.deleteMessage);
    const toggleReaction = useMutation(api.messages.toggleReaction);
    const editMessage = useMutation(api.messages.editMessage);
    const generateUploadUrl = useMutation(api.groups.generateUploadUrl);
    const setTyping = useMutation(api.messages.setTyping);

    const [newMessage, setNewMessage] = useState("");
    const [replyingTo, setReplyingTo] = useState<any | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: Id<"messages">; content: string } | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [deletingId, setDeletingId] = useState<Id<"messages"> | null>(null);
    const [showMentions, setShowMentions] = useState(false);
    const [filteredMembers, setFilteredMembers] = useState<{ userId: string; name: string }[]>([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [pendingMessages, setPendingMessages] = useState<any[]>([]);
    const [optimisticReactions, setOptimisticReactions] = useState<Record<string, any[]>>({});
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // ── Mobile long-press action sheet ──
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [longPressMsg, setLongPressMsg] = useState<any | null>(null);

    const handleLongPress = useCallback((msg: any) => {
        if (msg.type === 'date-separator' || msg.type === 'unread-separator' || msg.isPending) return;
        setLongPressMsg(msg);
    }, []);

    // ── Discord-like send cooldown ──
    const [sendCooldown, setSendCooldown] = useState(0);
    const lastSendTimesRef = useRef<number[]>([]);
    const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);


    // Simulated upload progress
    const simulatedProgress = useSimulatedProgress(isUploading);
    useEffect(() => {
        if (isUploading) {
            setUploadState(prev => prev.status === "uploading"
                ? { ...prev, progress: simulatedProgress }
                : prev
            );
        }
    }, [simulatedProgress, isUploading]);

    useEffect(() => {
        if (!audioBlob) { setAudioUrl(null); return; }
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [audioBlob]);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current?.state !== "inactive") {
                mediaRecorderRef.current?.stop();
                mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
            }
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        };
    }, []);

    const memberList = useMemo(() => {
        if (!members) return [];
        return members.filter((m: any) => m.userId !== me?.userId).map((m: any) => ({ userId: m.userId, name: m.name }));
    }, [members, me]);

    const memberMap = useMemo(() => {
        const map = new Map<string, any>();
        if (members) members.forEach((m: any) => map.set(m.userId, m));
        return map;
    }, [members]);

    const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0);
    useEffect(() => {
        try {
            const stored = localStorage.getItem(`lastRead-${channelId}`);
            if (stored) setLastReadTimestamp(parseInt(stored));
        } catch (e) {
            console.warn("localStorage access denied:", e);
        }
        return () => {
            try {
                localStorage.setItem(`lastRead-${channelId}`, Date.now().toString());
            } catch (e) {
                // ignore
            }
        };
    }, [channelId]);

    const messagesWithSeparators = useMemo(() => {
        const realMessages = messages ? [...messages].reverse() : [];
        const realClientSideIds = new Set(realMessages.map(m => m.clientSideId).filter(Boolean));
        const realIds = new Set(realMessages.map(m => m._id));
        const visiblePending = pendingMessages.filter(p =>
            !realIds.has(p._id as unknown as Id<"messages">) &&
            (!p.clientSideId || !realClientSideIds.has(p.clientSideId))
        );
        const allMessages = [...realMessages, ...visiblePending];
        const result: any[] = [];
        let lastDate = '';
        let unreadInserted = false;
        allMessages.forEach((msg) => {
            const msgDate = new Date(msg.createdAt).toDateString();
            if (msgDate !== lastDate) {
                result.push({ type: 'date-separator', date: msg.createdAt, _id: `date-${msgDate}` });
                lastDate = msgDate;
            }
            if (!unreadInserted && lastReadTimestamp && msg.createdAt > lastReadTimestamp && !msg.isPending && msg.userId !== me?.userId) {
                result.push({ type: 'unread-separator', _id: 'unread-sep' });
                unreadInserted = true;
            }
            result.push(msg);
        });
        return result;
    }, [messages, pendingMessages, lastReadTimestamp, me]);

    const rowVirtualizer = useVirtualizer({
        count: messagesWithSeparators.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 72,
        overscan: 12,
        measureElement: (el) => el?.getBoundingClientRect().height,
    });

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            rowVirtualizer.scrollToIndex(messagesWithSeparators.length - 1, { align: 'end' });
        });
    }, [rowVirtualizer, messagesWithSeparators.length]);

    // ── Highlight / jump-to-message support ──
    const [highlightedId, setHighlightedId] = useState<Id<"messages"> | null>(null);

    useEffect(() => {
        if (!highlightMessageId || !messagesWithSeparators.length) return;
        const idx = messagesWithSeparators.findIndex(
            (m) => m._id === highlightMessageId
        );
        if (idx === -1) return;
        // Scroll to the message
        rowVirtualizer.scrollToIndex(idx, { align: "center" });
        // Flash highlight
        setHighlightedId(highlightMessageId);
        const timer = setTimeout(() => {
            setHighlightedId(null);
            onHighlightDone?.();
        }, 2500);
        return () => clearTimeout(timer);
    }, [highlightMessageId, messagesWithSeparators.length]);

    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 150);
    }, []);

    useEffect(() => {
        const currentCount = messagesWithSeparators.length;
        if (currentCount > prevCountRef.current) {
            if (!scrollRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Only scroll if we are already near the bottom or it's our own new pending message
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
            const isMyNewMessage = pendingMessages.length > 0;

            if (isNearBottom || isMyNewMessage) {
                scrollToBottom();
            }
        }
        prevCountRef.current = currentCount;
    }, [messagesWithSeparators.length, scrollToBottom, pendingMessages.length]);

    useEffect(() => { scrollToBottom(); }, []);

    const debouncedSetTyping = useMemo(() => debounce(() => setTyping({ channelId }), 100), [channelId, setTyping]);
    useEffect(() => () => { debouncedSetTyping.cancel(); }, [debouncedSetTyping]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setNewMessage(value);
        if (value.trim()) debouncedSetTyping();
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const textAfterAt = value.slice(lastAtIndex + 1);
            if (!textAfterAt.includes(' ')) {
                const filtered = memberList.filter(m => m.name.toLowerCase().includes(textAfterAt.toLowerCase()));
                setFilteredMembers(filtered.slice(0, 5));
                setShowMentions(filtered.length > 0);
                setMentionIndex(0);
                return;
            }
        }
        setShowMentions(false);
    }, [memberList]);

    const insertMention = useCallback((member: { userId: string; name: string }) => {
        const lastAtIndex = newMessage.lastIndexOf('@');
        setNewMessage(newMessage.slice(0, lastAtIndex) + `@${member.name.split(' ')[0]} `);
        setShowMentions(false);
        inputRef.current?.focus();
    }, [newMessage]);

    const handleReply = useCallback((msg: any) => { setReplyingTo(msg); setEditingMessage(null); inputRef.current?.focus(); }, []);

    const handleEdit = useCallback((msg: any) => {
        if (msg.type !== 'text') return;
        setEditingMessage({ id: msg._id, content: msg.content });
        setReplyingTo(null);
        setNewMessage(msg.content);
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
                inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
                inputRef.current.focus();
            }
        }, 0);
    }, []);

    const handleCancelReplyEdit = useCallback(() => {
        setReplyingTo(null); setEditingMessage(null); setNewMessage("");
        if (inputRef.current) inputRef.current.style.height = '24px';
    }, []);

    // Helper ref for handleSend to avoid circular dependency in handleKeyDown
    const handleSendRef = useRef<() => void>(() => { });

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (showMentions && filteredMembers.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % filteredMembers.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); }
            else if (e.key === 'Escape') setShowMentions(false);
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); handleSendRef.current();
        } else if (e.key === "Escape") { handleCancelReplyEdit(); }
    }, [showMentions, filteredMembers, mentionIndex, insertMention, handleCancelReplyEdit]);

    const handleDelete = useCallback(async (messageId: Id<"messages">) => {
        if (deletingId) return;
        setDeletingId(messageId);
        try { await deleteMessage({ messageId }); toast.success("Message deleted"); }
        catch (e: any) { toast.error(e.message || "Failed to delete"); }
        finally { setDeletingId(null); }
    }, [deleteMessage, deletingId]);

    const handleToggleReaction = useCallback(async (messageId: Id<"messages">, emoji: string) => {
        setOptimisticReactions(prev => {
            const currentReactions = prev[messageId] || messages?.find(m => m._id === messageId)?.reactions || [];
            const existingIndex = currentReactions.findIndex((r: any) => r.emoji === emoji);
            let newReactions = JSON.parse(JSON.stringify(currentReactions));
            if (existingIndex !== -1) {
                const userIdx = newReactions[existingIndex].users.indexOf(me?.userId);
                if (userIdx !== -1) {
                    newReactions[existingIndex].users.splice(userIdx, 1);
                    if (newReactions[existingIndex].users.length === 0) newReactions.splice(existingIndex, 1);
                } else { newReactions[existingIndex].users.push(me?.userId); }
            } else { newReactions.push({ emoji, users: [me?.userId] }); }
            return { ...prev, [messageId]: newReactions };
        });
        try { await toggleReaction({ messageId, emoji }); }
        catch { toast.error("Failed to react"); setOptimisticReactions(prev => { const s = { ...prev }; delete s[messageId]; return s; }); }
    }, [messages, me, toggleReaction]);

    const removeFile = useCallback(() => {
        setSelectedFile(null); setUploadPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleSend = useCallback(async () => {
        if (isSending || (!newMessage.trim() && !selectedFile)) return;

        // Discord-like cooldown: if 5+ messages in 5s, enforce a 3s cooldown
        if (sendCooldown > 0) {
            toast.error(`Slow down! Wait ${sendCooldown}s`, { id: "cooldown", duration: 1500 });
            return;
        }
        const now = Date.now();
        lastSendTimesRef.current = lastSendTimesRef.current.filter(t => now - t < 5000);
        lastSendTimesRef.current.push(now);
        if (lastSendTimesRef.current.length >= 5) {
            const cooldownSecs = 3;
            setSendCooldown(cooldownSecs);
            lastSendTimesRef.current = [];
            let remaining = cooldownSecs;
            cooldownTimerRef.current = setInterval(() => {
                remaining--;
                setSendCooldown(remaining);
                if (remaining <= 0 && cooldownTimerRef.current) {
                    clearInterval(cooldownTimerRef.current);
                    cooldownTimerRef.current = null;
                }
            }, 1000);
        }

        if (editingMessage) {
            try { await editMessage({ messageId: editingMessage.id, content: newMessage }); handleCancelReplyEdit(); }
            catch { toast.error("Failed to edit"); }
            return;
        }
        const messageText = newMessage;
        const fileToUpload = selectedFile;
        const tempId = `temp-${crypto.randomUUID()}`;

        setNewMessage("");
        if (inputRef.current) { inputRef.current.value = ""; inputRef.current.style.height = '24px'; inputRef.current.focus(); }

        if (!fileToUpload) {
            const tempMsg = {
                _id: tempId, content: messageText, userId: me?.userId,
                author: { name: me?.name, avatarUrl: me?.imageUrl },
                createdAt: Date.now(), type: "text", isPending: true, fileUrl: null, reactions: [],
                parentMessage: replyingTo ? { _id: replyingTo._id, content: replyingTo.content, author: replyingTo.author ? { name: replyingTo.author.name } : null } : null,
            };
            setPendingMessages(prev => [...prev, tempMsg]);
            const { mentions } = parseMentions(messageText, memberList);
            try {
                await Promise.race([
                    sendMessage({ channelId, content: messageText, type: "text", parentMessageId: replyingTo?._id, mentions: mentions.length > 0 ? mentions : undefined, clientSideId: tempId }),
                    new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 10000))
                ]);
                setPendingMessages(prev => prev.filter(m => m._id !== tempId));
                setReplyingTo(null);
            } catch (e: any) {
                toast.error(e.message || "Failed to send");
                setNewMessage(messageText);
                setPendingMessages(prev => prev.filter(m => m._id !== tempId));
            }
            return;
        }

        // File upload
        setIsSending(true);
        const fileType = fileToUpload.type.startsWith('image/') ? "image" : "file";
        const tempMsg = {
            _id: tempId, content: messageText, userId: me?.userId,
            author: { name: me?.name, avatarUrl: me?.imageUrl },
            createdAt: Date.now(), type: fileType, isPending: true, fileUrl: uploadPreview, reactions: [],
            parentMessage: replyingTo ? { _id: replyingTo._id, content: replyingTo.content, author: replyingTo.author ? { name: replyingTo.author.name } : null } : null,
        };
        setPendingMessages(prev => [...prev, tempMsg]);
        removeFile();
        setUploadState({ status: "uploading", progress: 0, fileName: fileToUpload.name, fileType: fileToUpload.type.startsWith('image/') ? "image" : "file" });

        try {
            setIsUploading(true);
            let finalFile = fileToUpload;
            const uploadUrl = await generateUploadUrl({});
            const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": finalFile.type }, body: finalFile });
            const { storageId } = await result.json();
            setIsUploading(false);
            const { mentions } = parseMentions(messageText, memberList);
            await sendMessage({ channelId, content: messageText, type: fileType, fileId: storageId as Id<"_storage">, parentMessageId: replyingTo?._id, mentions: mentions.length > 0 ? mentions : undefined, clientSideId: tempId });
            setPendingMessages(prev => prev.filter(m => m._id !== tempId));
            setReplyingTo(null);
            setUploadState({ status: "success", fileName: fileToUpload.name });
        } catch (e: any) {
            toast.error(e.message || "Failed to send");
            setNewMessage(messageText);
            setSelectedFile(fileToUpload);
            setPendingMessages(prev => prev.filter(m => m._id !== tempId));
            setUploadState({ status: "error", message: "Upload failed" });
        } finally { setIsSending(false); setIsUploading(false); }
    }, [isSending, newMessage, selectedFile, editingMessage, editMessage, handleCancelReplyEdit, me, channelId, replyingTo, memberList, sendMessage, generateUploadUrl, uploadPreview, removeFile, sendCooldown]);

    // Update the ref so handleKeyDown can use it
    useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            await new Promise(r => setTimeout(r, 500));
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.start();
            setIsRecording(true); setIsPaused(false); setRecordingDuration(0);
            timerIntervalRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
        } catch { toast.error("Could not access microphone"); }
    }, []);

    const togglePause = useCallback(() => {
        if (!mediaRecorderRef.current) return;
        if (isPaused) {
            mediaRecorderRef.current.resume(); setIsPaused(false);
            timerIntervalRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
        } else {
            mediaRecorderRef.current.pause(); setIsPaused(true);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    }, [isPaused]);

    const stopRecording = useCallback(() => {
        if (!mediaRecorderRef.current) return;
        mediaRecorderRef.current.onstop = () => {
            setAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
            setIsRecording(false); setIsPaused(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setRecordingDuration(0);
            mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null; audioChunksRef.current = [];
        };
        mediaRecorderRef.current.stop();
    }, []);

    const cancelRecording = useCallback(() => {
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current = null;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setIsRecording(false); setIsPaused(false); setRecordingDuration(0); setAudioBlob(null);
        audioChunksRef.current = [];
    }, []);

    const handleSendVoice = useCallback(async (audioBlobInput: Blob) => {
        setIsSending(true);
        const tempId = `temp-${crypto.randomUUID()}`;
        const parentId = replyingTo?._id;
        setPendingMessages(prev => [...prev, {
            _id: tempId, content: "", userId: me?.userId,
            author: { name: me?.name, avatarUrl: me?.imageUrl },
            createdAt: Date.now(), type: "voice", isPending: true, fileUrl: null, reactions: [],
            parentMessage: replyingTo ? { _id: replyingTo._id, content: replyingTo.content, author: replyingTo.author ? { name: replyingTo.author.name } : null } : null,
        }]);
        setReplyingTo(null);
        setUploadState({ status: "uploading", progress: 0, fileType: "voice" });

        try {
            setIsUploading(true);
            const audioFile = new File([audioBlobInput], "voice-message.webm", { type: 'audio/webm' });
            const uploadUrl = await generateUploadUrl({});
            const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": audioFile.type }, body: audioFile });
            const { storageId } = await result.json();
            setIsUploading(false);
            await sendMessage({ channelId, content: "", type: "voice", fileId: storageId as Id<"_storage">, parentMessageId: parentId, clientSideId: tempId });
            setPendingMessages(prev => prev.filter(m => m._id !== tempId));
            setUploadState({ status: "success" });
        } catch {
            toast.error("Failed to send voice message");
            setPendingMessages(prev => prev.filter(m => m._id !== tempId));
            setUploadState({ status: "error", message: "Voice upload failed" });
        } finally {
            setIsSending(false); setIsUploading(false); setAudioBlob(null);
            setIsRecording(false); setIsPaused(false); setRecordingDuration(0);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    }, [me, replyingTo, channelId, sendMessage, generateUploadUrl]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingMessage) handleCancelReplyEdit();
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
        setSelectedFile(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setUploadPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else { setUploadPreview(null); }
    }, [editingMessage, handleCancelReplyEdit]);

    const handleEmojiClick = useCallback((emoji: string) => {
        setNewMessage(prev => prev + emoji);
    }, []);

    const typingText = useMemo(() => {
        if (!typingUsers?.length) return null;
        if (typingUsers.length === 1) return `${typingUsers[0].userName} is typing`;
        if (typingUsers.length === 2) return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
        return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing`;
    }, [typingUsers]);

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background relative">
            {/* Upload Progress Bar */}
            <UploadProgressBar uploadState={uploadState} />

            {/* Messages — only scrollable section */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto min-h-0 py-2 scrollbar-thin"
                style={{ paddingBottom: isMobile ? '130px' : '8px' }}
            >
                {/* Catch Me Up — scrolls with messages */}
                <CatchMeUpButton channelId={channelId} />
                {status === "LoadingFirstPage" ? (
                    <div className="flex flex-col gap-4 p-4 h-full justify-end">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "flex-row-reverse" : "")}>
                                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                                <div className="flex flex-col gap-2 max-w-[70%]">
                                    <Skeleton className="h-4 w-24 rounded-md" />
                                    <Skeleton className={cn("h-10 rounded-2xl w-full", i % 3 === 0 ? "w-50" : "w-75")} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : messagesWithSeparators.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-20 opacity-0 animate-in fade-in duration-700 fill-mode-forwards" style={{ animationDelay: '0.2s' }}>
                        <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-6 ring-1 ring-border/50">
                            <MessagesSquare className="w-10 h-10 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground/80 mb-2">It's quiet in here...</h3>
                        <p className="text-sm text-muted-foreground max-w-70 leading-relaxed">
                            Be the first to break the silence! Start the conversation below.
                        </p>
                    </div>
                ) : (
                    <>
                        {status === "CanLoadMore" && (
                            <div className="flex justify-center py-2">
                                <Button variant="ghost" size="sm" onClick={() => loadMore(20)} className="text-xs text-muted-foreground hover:text-foreground rounded-full">
                                    Load older messages
                                </Button>
                            </div>
                        )}

                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const msg = messagesWithSeparators[virtualRow.index];
                                const prevMsg = virtualRow.index > 0 ? messagesWithSeparators[virtualRow.index - 1] : null;
                                const style = { position: 'absolute' as const, top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` };

                                if (msg.type === 'date-separator') return (
                                    <div key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={style}>
                                        <div className="flex items-center gap-3 px-4 py-2 my-1">
                                            <div className="flex-1 h-px bg-border/60" />
                                            <span className="text-[11px] text-muted-foreground/60 font-semibold px-3 py-1 bg-muted/40 rounded-full">
                                                {new Date(msg.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                                            </span>
                                            <div className="flex-1 h-px bg-border/60" />
                                        </div>
                                    </div>
                                );

                                if (msg.type === 'unread-separator') return (
                                    <div key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={style}>
                                        <div className="flex items-center gap-3 px-4 py-1 my-1">
                                            <div className="flex-1 h-px bg-destructive/40" />
                                            <span className="text-[11px] text-destructive font-bold px-3 py-0.5 bg-destructive/10 rounded-full">New</span>
                                            <div className="flex-1 h-px bg-destructive/40" />
                                        </div>
                                    </div>
                                );

                                return (
                                    <div key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={style}>
                                        <MessageRowWrapper
                                            msg={msg} prevMsg={prevMsg} me={me}
                                            memberMap={memberMap} memberList={memberList}
                                            optimisticReactions={optimisticReactions}
                                            onToggleReaction={handleToggleReaction}
                                            onDelete={handleDelete} onReply={handleReply}
                                            onEdit={handleEdit} onExpandImage={setExpandedImage}
                                            isDeleting={deletingId === msg._id}
                                            isHighlighted={highlightedId === msg._id}
                                            onLongPress={isMobile ? handleLongPress : undefined}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {showScrollButton && (
                <button onClick={scrollToBottom}
                    className="absolute bottom-24 right-4 z-30 bg-primary text-primary-foreground rounded-full p-2.5 shadow-lg hover:bg-primary/90 transition-colors">
                    <ArrowDown className="w-4 h-4" />
                </button>
            )}

            {/* Cooldown warning */}
            {sendCooldown > 0 && (
                <div className="shrink-0 flex items-center justify-center gap-1.5 py-1 bg-destructive/10 border-t border-destructive/20">
                    <Loader2 className="w-3 h-3 text-destructive animate-spin" />
                    <span className="text-[11px] text-destructive font-medium">Slow down! You can send again in {sendCooldown}s</span>
                </div>
            )}

            {/* Typing Indicator — floats above the input border */}
            <div className="relative shrink-0">
                <div className={cn(
                    "absolute bottom-0 left-0 right-0 px-4 pointer-events-none transition-all duration-200 ease-out",
                    typingText ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                )}>
                    <div className="flex items-center gap-1.5 h-6">
                        <div className="flex items-end gap-0.75 h-4">
                            {[0, 1, 2].map(i => (
                                <span
                                    key={i}
                                    className="w-1.25 h-1.25 bg-foreground/50 rounded-full"
                                    style={{
                                        animationName: typingText ? 'discordBounce' : 'none',
                                        animationDuration: '1.4s',
                                        animationTimingFunction: 'ease-in-out',
                                        animationIterationCount: 'infinite',
                                        animationDelay: `${i * 0.16}s`,
                                    }}
                                />
                            ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                            <strong className="font-semibold text-foreground/70">{typingText?.split(' is typing')[0].split(' and ')[0]}</strong>
                            {typingText?.includes(' and ') ? ` and ${typingText.split(' and ').slice(1).join(' and ')}` : ' is typing...'}
                        </span>
                    </div>
                </div>
            </div>

            <MobileMessageInput
                channelId={channelId} channelName={channelName}
                isManagerOnly={isManagerOnly} canManage={canManage}
                replyingTo={replyingTo} editingMessage={editingMessage}
                newMessage={newMessage} selectedFile={selectedFile}
                uploadPreview={uploadPreview} isSending={isSending}
                isUploading={isUploading} audioBlob={audioBlob}
                audioUrl={audioUrl} isRecording={isRecording}
                isPaused={isPaused} recordingDuration={recordingDuration}
                memberList={memberList} showMentions={showMentions}
                filteredMembers={filteredMembers} mentionIndex={mentionIndex}
                onMessageChange={handleInputChange} onKeyDown={handleKeyDown}
                onSend={handleSend} onCancelReplyEdit={handleCancelReplyEdit}
                onFileSelect={handleFileSelect} onRemoveFile={removeFile}
                onStartRecording={startRecording} onTogglePause={togglePause}
                onStopRecording={stopRecording} onCancelRecording={cancelRecording}
                onSendVoice={handleSendVoice} onInsertMention={insertMention}
                onEmojiClick={handleEmojiClick}
                inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
                fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                timeoutUntil={myTimeout?.timeoutUntil ?? null}
            />

            {/* ─── Long-press action sheet (mobile) ─── */}
            <Drawer open={!!longPressMsg} onOpenChange={(open) => { if (!open) setLongPressMsg(null); }}>
                <DrawerContent className="rounded-t-3xl px-2 pb-6">
                    <DrawerTitle className="sr-only">Message Actions</DrawerTitle>
                    {longPressMsg && (() => {
                        const isOwnMessage = longPressMsg.userId === me?.userId;
                        const authorName = longPressMsg.author?.name || "Unknown";
                        const preview = longPressMsg.content
                            ? longPressMsg.content.length > 60 ? longPressMsg.content.slice(0, 60) + "…" : longPressMsg.content
                            : longPressMsg.type === "image" ? "Photo" : longPressMsg.type === "voice" ? "Voice message" : "Attachment";
                        return (
                            <>
                                {/* Preview */}
                                <div className="px-4 pt-4 pb-3 border-b border-border/50">
                                    <p className="text-xs font-semibold text-foreground/70 mb-0.5">{authorName}</p>
                                    <p className="text-sm text-muted-foreground truncate">{preview}</p>
                                </div>
                                {/* Actions */}
                                <div className="py-2 space-y-0.5">
                                    <button
                                        onClick={() => { handleReply(longPressMsg); setLongPressMsg(null); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60 active:bg-muted rounded-xl transition-colors"
                                    >
                                        <Reply className="w-5 h-5 text-muted-foreground" />
                                        Reply
                                    </button>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60 active:bg-muted rounded-xl transition-colors">
                                                <Smile className="w-5 h-5 text-muted-foreground" />
                                                React
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent side="top" align="center" className="w-auto p-0 border-none bg-transparent shadow-none mb-2">
                                            <EmojiPicker theme={"auto" as any} onEmojiClick={(e) => { handleToggleReaction(longPressMsg._id, e.emoji); setLongPressMsg(null); }} />
                                        </PopoverContent>
                                    </Popover>
                                    {isOwnMessage && longPressMsg.type === "text" && (
                                        <button
                                            onClick={() => { handleEdit(longPressMsg); setLongPressMsg(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60 active:bg-muted rounded-xl transition-colors"
                                        >
                                            <Pencil className="w-5 h-5 text-muted-foreground" />
                                            Edit Message
                                        </button>
                                    )}
                                    {isOwnMessage && (
                                        <button
                                            onClick={() => { handleDelete(longPressMsg._id); setLongPressMsg(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/15 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                            Delete Message
                                        </button>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DrawerContent>
            </Drawer>

            {expandedImage && (
                <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setExpandedImage(null)}>
                    <button className="absolute top-4 right-4 bg-muted text-muted-foreground hover:text-foreground rounded-full p-2 transition-colors" onClick={() => setExpandedImage(null)}>
                        <X className="w-5 h-5" />
                    </button>
                    <img src={expandedImage} alt="Expanded" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}

// fix missing import
import { ArrowDown } from "lucide-react";
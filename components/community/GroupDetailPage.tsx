"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    MapPin,
    Users,
    ArrowLeft,
    Globe,
    Lock,
    Crown,
    UserPlus,
    Clock,
    LogOut,
    Calendar,
    Activity,
    Shield,
    MoreVertical,
    Share2,
    Search,
    MessageSquare,
    Zap,
    X,
    Check,
    Image as ImageIcon,
    Eye,
    History,
    ArrowUp,
    ArrowDown,
    UserX,
    LogIn,
    Settings,
    TrendingUp,
} from "lucide-react";
import { GroupChatLayout } from "./chat/GroupChatLayout";
import { GroupBottomNav } from "./GroupBottomNav";
import { GroupGovernance } from "./GroupGovernance";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
    DrawerClose,
} from "@/components/ui/drawer";
import { RotateCcw, Gavel, Loader2, MapPinIcon, Video, Upload, Camera, BarChart3, DollarSign, Ticket, ChevronRight, ChevronLeft, LayoutList, CalendarDays } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { PlaceAutocomplete } from "@/components/ui/place-autocomplete";

// ─── Constants (hoisted outside component, never re-created) ────────

const CATEGORY_EMOJI: Record<string, string> = {
    "Neighborhood": "🏘️",
    "Environment": "🌱",
    "Education": "📚",
    "Arts & Culture": "🎨",
    "Sports & Recreation": "⚽",
    "Safety & Watch": "🚨",
    "Local Business": "🏪",
    "Tech & Innovation": "💻",
    "Health & Wellness": "💪",
    "Other": "📌",
};

const TAB_CONFIG = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "town-hall", label: "Town Hall", icon: MessageSquare },
    { id: "events", label: "Events", icon: Calendar },
    { id: "members", label: "Members", icon: Users },
    { id: "governance", label: "Governance", icon: Shield },
    { id: "logs", label: "Logs", icon: History },
] as const;

type TabId = (typeof TAB_CONFIG)[number]["id"];

// ─── Memoized Sub-Components ────────────────────────────────────────

const MemberRow = memo(function MemberRow({
    member,
    isManager,
    onPromote,
    onRemove,
}: {
    member: any;
    isManager: boolean;
    onPromote?: (userId: string) => void;
    onRemove?: (userId: string) => void;
}) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group/row">
            <ProfileAvatar userId={member.userId} name={member.name} avatarUrl={member.avatarUrl} className="w-9 h-9" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-semibold font-mono text-sm truncate text-foreground">{member.name}</p>
                    {member.role === "founder" && (
                        <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20">Founder</span>
                    )}
                    {member.role === "manager" && (
                        <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20">Manager</span>
                    )}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase">{member.role}</p>
            </div>
            {isManager && member.role === "member" && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center justify-center h-7 w-7 opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border rounded-sm">
                            <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="font-mono uppercase text-xs">
                        <DropdownMenuItem className="text-xs" onClick={() => onPromote?.(member.userId)}>
                            <Crown className="w-3.5 h-3.5 mr-2" /> Promote to Manager
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs text-red-500 focus:text-red-500" onClick={() => onRemove?.(member.userId)}>
                            <LogOut className="w-3.5 h-3.5 mr-2" /> Remove
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
});

const SidebarEventCard = memo(function SidebarEventCard({ event }: { event: any }) {
    const date = useMemo(() => new Date(event.startTime), [event.startTime]);
    const status = event.computedStatus ?? "upcoming";
    const statusDot = status === "ongoing" ? "bg-amber-500 animate-pulse" : status === "upcoming" ? "bg-primary" : "bg-muted-foreground/40";
    return (
        <div className="px-4 py-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-start gap-3">
                <div className={cn(
                    "p-1.5 border font-mono font-bold text-xs text-center min-w-11 leading-tight shrink-0 rounded-lg",
                    status === "ongoing" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                        status === "upcoming" ? "bg-primary/10 text-primary border-primary/20" :
                            "bg-muted/50 text-muted-foreground border-border"
                )}>
                    <span className="block text-[8px] uppercase">
                        {date.toLocaleString("default", { month: "short" }).toUpperCase()}
                    </span>
                    <span className="text-sm">{date.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-foreground truncate font-mono uppercase">{event.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot)} />
                        <span className="text-[10px] text-muted-foreground font-mono">
                            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" /> {event.attendees?.length ?? 0}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

const EventCard = memo(function EventCard({
    event,
    userId,
    isManager,
    onAttend,
    onPay,
    onSelect,
}: {
    event: any;
    userId?: string;
    isManager?: boolean;
    onAttend: (eventId: Id<"events">) => void;
    onPay: (event: any) => void;
    onSelect?: (event: any) => void;
}) {
    const isAttending = userId ? event.attendees.includes(userId) : false;
    const isFull = event.capacity && event.attendees.length >= event.capacity;
    const date = useMemo(() => new Date(event.startTime), [event.startTime]);
    const fillPercent = event.capacity ? Math.round((event.attendees.length / event.capacity) * 100) : null;

    // Compute proper event status
    const status: "upcoming" | "ongoing" | "completed" | "cancelled" = event.computedStatus
        ?? (event.status === "cancelled" ? "cancelled"
            : event.status === "completed" ? "completed"
                : (event.endTime || event.startTime) < Date.now() ? "completed"
                    : event.startTime <= Date.now() ? "ongoing"
                        : "upcoming");
    const isDone = status === "completed" || status === "cancelled";

    // Relative time helper
    const relativeTime = useMemo(() => {
        const diff = event.startTime - Date.now();
        if (status === "ongoing") return "Happening now";
        if (isDone) return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const days = Math.floor(diff / 86400000);
        if (days === 0) return "Today";
        if (days === 1) return "Tomorrow";
        if (days < 7) return `In ${days} days`;
        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }, [event.startTime, status, isDone, date]);

    const statusConfig = {
        upcoming: { label: "Upcoming", variant: "default" as const, className: "" },
        ongoing: { label: "Live Now", variant: "default" as const, className: "bg-amber-500 hover:bg-amber-500/90 text-white border-amber-500 animate-pulse" },
        completed: { label: "Completed", variant: "secondary" as const, className: "" },
        cancelled: { label: "Cancelled", variant: "destructive" as const, className: "bg-red-500/10 text-red-500 border-red-500/30" },
    };
    const sc = statusConfig[status];

    return (
        <div
            className={cn(
                "overflow-hidden border border-border rounded-xl bg-card/50 hover:bg-card transition-all group/event cursor-pointer hover:shadow-md hover:shadow-primary/5",
                isDone && "opacity-60",
                status === "ongoing" && "ring-1 ring-amber-500/30"
            )}
            onClick={() => onSelect?.(event)}
        >
            {/* Cover image or gradient header */}
            <div className="relative h-28 sm:h-32 overflow-hidden bg-muted">
                {event.coverImageUrl ? (
                    <img
                        src={event.coverImageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover/event:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-primary/15 via-primary/5 to-muted flex items-center justify-center">
                        <Calendar className="w-10 h-10 text-muted-foreground/10" />
                    </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-card via-card/30 to-transparent" />

                {/* Status + badges overlay */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
                    <Badge variant={sc.variant} className={cn("font-mono text-[9px] uppercase shadow-sm", sc.className)}>
                        {sc.label}
                    </Badge>
                    <div className="flex gap-1.5">
                        {event.isTravelEvent && (
                            <Badge className="text-[9px] font-mono uppercase gap-0.5 bg-violet-500/90 text-white border-none shadow-sm">
                                ✈ Travel
                            </Badge>
                        )}
                        {event.isPaid && (
                            <Badge variant="outline" className="font-mono text-[9px] border-emerald-500/40 text-emerald-500 bg-card/80 backdrop-blur-sm shadow-sm">
                                ₹{event.price}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Date badge - bottom left of cover */}
                <div className="absolute bottom-2.5 left-2.5">
                    <div className={cn(
                        "p-1.5 border font-mono font-bold text-xs text-center min-w-11 leading-tight rounded-lg bg-card/90 backdrop-blur-sm shadow-sm",
                        isDone ? "text-muted-foreground border-border" : status === "ongoing" ? "text-amber-600 border-amber-500/30" : "text-primary border-primary/20"
                    )}>
                        <span className="block text-[8px] uppercase">
                            {date.toLocaleString("default", { month: "short" }).toUpperCase()}
                        </span>
                        <span className="text-sm">{date.getDate()}</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                <div>
                    <h3 className="text-sm font-bold font-mono tracking-tight group-hover/event:text-primary transition-colors uppercase leading-snug line-clamp-2">
                        {event.title}
                    </h3>
                    {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{event.description}</p>
                    )}
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relativeTime} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.location}
                    </span>
                </div>

                {/* Capacity bar */}
                {fillPercent !== null && !isDone && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" /> {event.attendees.length}/{event.capacity}
                            </span>
                            <span className={cn(
                                "font-bold",
                                fillPercent >= 90 ? "text-red-500" : fillPercent >= 60 ? "text-amber-500" : "text-emerald-500"
                            )}>
                                {fillPercent}% full
                            </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    fillPercent >= 90 ? "bg-red-500" : fillPercent >= 60 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${Math.min(fillPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                )}
                {fillPercent === null && !isDone && (
                    <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> {event.attendees.length} {isDone ? "attended" : "going"}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                    <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                        {status === "cancelled" ? (
                            <Button variant="outline" disabled className="w-full h-9 font-mono text-xs uppercase text-red-400 rounded-lg">Cancelled</Button>
                        ) : status === "completed" ? (
                            <Button variant="outline" disabled className="w-full h-9 font-mono text-xs uppercase rounded-lg">Event Ended</Button>
                        ) : isAttending ? (
                            <Button variant="secondary" disabled className="w-full h-9 font-mono text-xs uppercase gap-2 bg-emerald-500/10 text-emerald-500 border-border rounded-lg">
                                <Check className="w-4 h-4" /> Going
                            </Button>
                        ) : isFull ? (
                            <Button variant="outline" disabled className="w-full h-9 font-mono text-xs uppercase rounded-lg">Full</Button>
                        ) : (
                            <Button
                                className="w-full h-9 font-mono text-xs uppercase gap-2 shadow-lg shadow-primary/20 rounded-lg"
                                onClick={() => (event.isPaid ? onPay(event) : onAttend(event._id))}
                            >
                                {event.isPaid ? <><Ticket className="w-3.5 h-3.5" /> ₹{event.price} Ticket</> : <><UserPlus className="w-3.5 h-3.5" /> Attend</>}
                            </Button>
                        )}
                    </div>
                    {isManager && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg"
                            onClick={(e) => { e.stopPropagation(); onSelect?.(event); }}
                        >
                            <BarChart3 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
});

const ActivityRow = memo(function ActivityRow({ member }: { member: any }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
            <Avatar className="w-7 h-7 border border-border">
                <AvatarImage src={member.avatarUrl} />
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{member.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground">
                    <span className="font-bold">{member.name}</span>
                    <span className="text-muted-foreground">
                        {" "}{member.role === "founder" ? "created the group" : "joined the community"}
                    </span>
                </p>
            </div>
            <span className="font-mono text-[9px] uppercase text-muted-foreground shrink-0 border border-border px-1.5 py-0.5 rounded-sm">
                {member.role}
            </span>
        </div>
    );
});

const GroupDetailSkeleton = memo(function GroupDetailSkeleton() {
    return (
        <div className="space-y-0">
            <Skeleton className="h-48 w-full opacity-50" />
            <div className="space-y-3 p-6 max-w-5xl mx-auto">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-48" />
            </div>
        </div>
    );
});

// ─── Main Component ─────────────────────────────────────────────────

interface GroupDetailPageContentProps {
    groupId: Id<"groups">;
}

export default function GroupDetailPageContent({ groupId }: GroupDetailPageContentProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.replace("/auth/login");
        }
    }, [isAuthLoading, isAuthenticated, router]);

    // ── UI State ──
    const [isJoining, setIsJoining] = useState(false);
    const [joinMessage, setJoinMessage] = useState("");
    const [showJoinDialog, setShowJoinDialog] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editDescription, setEditDescription] = useState("");
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [editTags, setEditTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [showAllLogs, setShowAllLogs] = useState(false);
    const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [eventForm, setEventForm] = useState({
        title: "",
        description: "",
        location: "",
        locationCoords: null as { lat: number; lon: number } | null,
        startTime: "",
        endTime: "",
        eventType: "in-person" as "in-person" | "online",
        isPaid: false,
        price: 0,
        capacity: 0,
    });

    const [activeTab, setActiveTab] = useState<TabId>(
        (searchParams.get("tab") as TabId) || "overview"
    );
    const [eventsView, setEventsView] = useState<"list" | "calendar">("list");
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

    // ── Tab navigation (stable callback) ──
    const handleTabChange = useCallback(
        (tabId: TabId) => {
            setActiveTab(tabId);
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", tabId);
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [searchParams, router]
    );

    // ── Data — conditional fetching for performance ──
    const group = useQuery(api.groups.getGroup, isAuthenticated ? { groupId } : "skip");
    const members = useQuery(api.groups.getGroupMembers, isAuthenticated ? { groupId } : "skip");
    const myStatus = useQuery(api.groups.getMyJoinRequestStatus, isAuthenticated ? { groupId } : "skip");
    const groupStats = useQuery(api.groups.getGroupStats, isAuthenticated ? { groupId } : "skip");

    // Only fetch logs when the logs tab is active
    const governanceLogs = useQuery(
        api.groups.getGovernanceLogs,
        isAuthenticated && activeTab === "logs" ? { groupId } : "skip"
    );

    // Only fetch events when the tab needs them
    const needEvents = activeTab === "overview" || activeTab === "events";
    const groupEvents = useQuery(
        api.groups.getGroupEvents,
        isAuthenticated && needEvents ? { groupId } : "skip"
    );

    // ── Mutations (stable references via hooks) ──
    const updateGroupMut = useMutation(api.groups.updateGroup);
    const requestToJoin = useMutation(api.groups.requestToJoin);
    const leaveGroup = useMutation(api.groups.leaveGroup);
    const createEvent = useMutation(api.events.createEvent);
    const attendEvent = useMutation(api.events.attendEvent);
    const proposeAction = useMutation(api.groups.proposeAction);
    const updateMemberRole = useMutation(api.groups.updateMemberRole);
    const removeMember = useMutation(api.groups.removeMember);
    const generateUploadUrl = useMutation(api.groups.generateUploadUrl);

    const createOrder = useAction(api.payments.createOrder);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const verifyPayment = useAction(api.payments.verifyPayment);

    // ── Derived state (memoized to avoid recalc on every render) ──
    const isManager = myStatus?.status === "member" && (myStatus.role === "manager" || myStatus.role === "founder");


    const isMember = myStatus?.status === "member";
    const isPending = myStatus?.status === "pending";

    const { managerCount, governanceHealth } = useMemo(() => {
        const mCount = members?.filter((m: any) => m.role === "manager" || m.role === "founder").length || 0;
        const memberCount = members?.length ?? 0;
        const isBootstrap = memberCount <= 3;
        const violation = !isBootstrap && mCount < 2;
        const health = violation
            ? "At Risk"
            : mCount === 2 && memberCount > 5
                ? "Warning"
                : "Healthy";
        return { managerCount: mCount, governanceHealth: health };
    }, [members]);

    const filteredMembers = useMemo(() => {
        if (!members) return [];
        if (!memberSearch.trim()) return members;
        const q = memberSearch.toLowerCase();
        return members.filter((m: any) => m.name.toLowerCase().includes(q));
    }, [members, memberSearch]);

    const managers = useMemo(
        () => members?.filter((m: any) => m.role === "founder" || m.role === "manager") ?? [],
        [members]
    );

    const tabCounts = useMemo<Record<string, number | undefined>>(
        () => ({
            events: groupEvents?.length,
            members: members?.length,
        }),
        [groupEvents?.length, members?.length]
    );

    const isTownHall = activeTab === "town-hall";

    // ── Jump-to-message for moderation flags ──
    const [jumpToChannel, setJumpToChannel] = useState<Id<"channels"> | null>(null);
    const [jumpToMessage, setJumpToMessage] = useState<Id<"messages"> | null>(null);

    const handleJumpToMessage = useCallback((channelId: Id<"channels">, messageId: Id<"messages">) => {
        setJumpToChannel(channelId);
        setJumpToMessage(messageId);
        handleTabChange("town-hall");
    }, [handleTabChange]);

    const handleHighlightDone = useCallback(() => {
        setJumpToChannel(null);
        setJumpToMessage(null);
    }, []);

    // ── Stable callbacks ──
    const executeJoin = useCallback(async () => {
        setIsJoining(true);
        try {
            if (joinMessage && joinMessage.length > 300) {
                toast.error("Message too long (max 300 characters)");
                return;
            }
            const result = await requestToJoin({ groupId, message: joinMessage });
            if (result.joined) {
                toast.success("You've joined the group!");
            } else {
                toast.success("Join request sent! The manager will review it.");
            }
            setShowJoinDialog(false);
            setJoinMessage("");
        } catch (e: any) {
            toast.error(e.message || "Failed to join");
        } finally {
            setIsJoining(false);
        }
    }, [groupId, joinMessage, requestToJoin]);

    const handleLeave = useCallback(async () => {
        try {
            await leaveGroup({ groupId });
            toast.success("You've left the group.");
        } catch (e: any) {
            toast.error(e.message || "Failed to leave");
        }
    }, [groupId, leaveGroup]);

    const handleShare = useCallback(() => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
    }, []);

    const startEditDescription = useCallback(() => {
        setEditDescription(group?.description || "");
        setIsEditingDescription(true);
    }, [group?.description]);

    const saveDescription = useCallback(async () => {
        if (!editDescription.trim()) return;
        setIsSaving(true);
        try {
            await updateGroupMut({ groupId, description: editDescription.trim() });
            toast.success("Description updated");
            setIsEditingDescription(false);
        } catch (e: any) {
            toast.error(e.message || "Failed to update");
        } finally {
            setIsSaving(false);
        }
    }, [groupId, editDescription, updateGroupMut]);

    const startEditTags = useCallback(() => {
        setEditTags(group?.tags || []);
        setNewTag("");
        setIsEditingTags(true);
    }, [group?.tags]);

    const addTag = useCallback(() => {
        const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (tag && !editTags.includes(tag) && editTags.length < 10) {
            setEditTags((prev) => [...prev, tag]);
            setNewTag("");
        }
    }, [newTag, editTags]);

    const removeTag = useCallback((tag: string) => {
        setEditTags((prev) => prev.filter((t) => t !== tag));
    }, []);

    const saveTags = useCallback(async () => {
        setIsSaving(true);
        try {
            await updateGroupMut({ groupId, tags: editTags });
            toast.success("Tags updated");
            setIsEditingTags(false);
        } catch (e: any) {
            toast.error(e.message || "Failed to update");
        } finally {
            setIsSaving(false);
        }
    }, [groupId, editTags, updateGroupMut]);

    const handleAttendEvent = useCallback(
        async (eventId: Id<"events">) => {
            try {
                await attendEvent({ eventId });
                toast.success("See you there!");
            } catch (e: any) {
                toast.error(e.message || "Failed to join event");
            }
        },
        [attendEvent]
    );

    const handlePayForEvent = useCallback(
        async (event: any) => {
            try {
                const order = await createOrder({
                    amount: event.price,
                    currency: "INR",
                    receipt: `event_${event._id}`,
                    notes: { eventId: event._id, userId: myStatus?.userId },
                });

                // Cache Razorpay script — only load once
                const loadRazorpay = () =>
                    new Promise((resolve) => {
                        if ((window as any).Razorpay) return resolve(true);
                        const script = document.createElement("script");
                        script.src = "https://checkout.razorpay.com/v1/checkout.js";
                        script.onload = () => resolve(true);
                        script.onerror = () => resolve(false);
                        document.body.appendChild(script);
                    });

                await loadRazorpay();

                const rzp = new (window as any).Razorpay({
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: order.amount,
                    currency: order.currency,
                    name: "CityHub",
                    description: `Ticket for ${event.title}`,
                    order_id: order.id,
                    handler: async (response: any) => {
                        try {
                            await verifyPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                type: "event",
                                targetId: event._id,
                                amount: event.price,
                                userId: myStatus?.userId ?? "",
                            });
                            toast.success("Ticket purchased successfully!");
                        } catch (e: any) {
                            toast.error(e.message || "Payment verification failed");
                        }
                    },
                    prefill: { name: "User", email: "" },
                    theme: { color: "#10b981" },
                });
                rzp.open();
            } catch (e: any) {
                toast.error(e.message || "Failed to initiate payment");
            }
        },
        [createOrder, verifyPayment, myStatus?.userId]
    );

    const handleCreateEvent = useCallback(async () => {
        setIsCreatingEvent(true);
        try {
            await createEvent({
                groupId,
                title: eventForm.title,
                description: eventForm.description,
                location: eventForm.location,
                locationCoords: eventForm.locationCoords || undefined,
                startTime: new Date(eventForm.startTime).getTime(),
                eventType: eventForm.eventType,
                isPaid: eventForm.isPaid,
                price: eventForm.price,
                capacity: eventForm.capacity,
            });
            toast.success("Event created successfully!");
            setShowCreateEventDialog(false);
            setEventForm({
                title: "", description: "", location: "", locationCoords: null, startTime: "", endTime: "",
                eventType: "in-person", isPaid: false, price: 0, capacity: 0,
            });
        } catch (e: any) {
            toast.error(e.message || "Failed to create event");
        } finally {
            setIsCreatingEvent(false);
        }
    }, [groupId, eventForm, createEvent]);

    const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }
        setIsUploadingCover(true);
        try {
            const uploadUrl = await generateUploadUrl();
            const res = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await res.json();
            await updateGroupMut({ groupId, coverImageId: storageId });
            toast.success("Cover image updated!");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload cover");
        } finally {
            setIsUploadingCover(false);
            if (coverInputRef.current) coverInputRef.current.value = "";
        }
    }, [groupId, generateUploadUrl, updateGroupMut]);

    // ── Loading states ──
    if (isAuthLoading || group === undefined) return <GroupDetailSkeleton />;

    if (group === null) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-lg">
                    <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Group not found</h2>
                <Button onClick={() => router.push("/community")} variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Community
                </Button>
            </div>
        );
    }

    // Derived from live members array — not the stale stored field
    const liveMemberCount = members?.length ?? 0;

    return (
        <div
            className={cn(
                "bg-background flex flex-col",
                isTownHall
                    ? "h-full lg:h-screen overflow-hidden"
                    : "min-h-dvh lg:min-h-screen pb-20"
            )}
        >
            {/* ═══ 1. FULL-BLEED HEADER ═══ */}
            {!isTownHall && (
                <div className="relative bg-card border-b border-border shrink-0">
                    <div className="h-32 sm:h-52 lg:h-64 w-full overflow-hidden relative bg-muted group/cover">
                        {group.coverImageUrl ? (
                            <img
                                src={group.coverImageUrl}
                                alt={group.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-105"
                                loading="eager"
                            />
                        ) : (
                            <div className="w-full h-full bg-linear-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
                                <span className="text-6xl opacity-20">{CATEGORY_EMOJI[group.category] || "📌"}</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />

                        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 sm:p-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 px-3 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 hover:text-white gap-2"
                                onClick={() => router.push("/community")}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline text-xs">Back</span>
                            </Button>
                            {isManager && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 hover:text-white gap-2"
                                        onClick={() => coverInputRef.current?.click()}
                                        disabled={isUploadingCover}
                                    >
                                        {isUploadingCover ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ImageIcon className="w-4 h-4" />
                                        )}
                                        <span className="hidden sm:inline text-xs">
                                            {isUploadingCover ? "Uploading..." : "Change Cover"}
                                        </span>
                                    </Button>
                                    <input
                                        ref={coverInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleCoverUpload}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end -mt-8 sm:-mt-14 pb-4 sm:pb-5 relative z-10">
                            <div className="shrink-0">
                                <div className="w-16 h-16 sm:w-24 sm:h-24 p-1 bg-card border-2 border-border rounded-lg">
                                    <div className="w-full h-full bg-muted flex items-center justify-center rounded-md text-2xl sm:text-4xl">
                                        {CATEGORY_EMOJI[group.category] || "📌"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 pb-0.5">
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                                        {group.category}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                        {group.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                        {group.isPublic ? "Public" : "Private"}
                                    </Badge>
                                </div>
                                <h1 className="text-lg sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground leading-tight">
                                    {group.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5" />{group.city.name}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" />{liveMemberCount} Members
                                    </span>
                                    {groupEvents && groupEvents.length > 0 && (
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />{groupEvents.length} Events
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleShare}>
                                    <Share2 className="w-4 h-4" />
                                </Button>
                                {isMember && !isManager ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="secondary" className="h-9 gap-2 flex-1 sm:flex-none">
                                                <Check className="w-4 h-4" /> Joined
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={handleLeave} className="text-red-500 focus:text-red-500">
                                                <LogOut className="w-4 h-4 mr-2" /> Leave Group
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : isPending ? (
                                    <Button variant="secondary" disabled className="h-9 gap-2 flex-1 sm:flex-none opacity-80">
                                        <Clock className="w-4 h-4" /> Pending
                                    </Button>
                                ) : isManager ? (
                                    <Button variant="default" className="h-9 gap-2 flex-1 sm:flex-none pointer-events-none">
                                        <Crown className="w-4 h-4" /> Manager
                                    </Button>
                                ) : (
                                    <Button onClick={() => setShowJoinDialog(true)} disabled={isJoining} className="h-9 gap-2 flex-1 sm:flex-none">
                                        <UserPlus className="w-4 h-4" />
                                        {isJoining ? "Joining..." : "Join Group"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ 2. STICKY TAB BAR (Desktop) ═══ */}
            <div className={cn(
                "sticky top-12 md:top-0 z-40 bg-card border-b border-border shrink-0 hidden md:block",
                isTownHall && "top-0"
            )}>
                <div className={cn(
                    "mx-auto px-2 sm:px-6 lg:px-8",
                    !isTownHall && "max-w-6xl"
                )}>
                    <nav className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px" aria-label="Tabs">
                        {isTownHall && (
                            <button
                                onClick={() => router.push("/community")}
                                className="flex items-center gap-1.5 px-3 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap border-b-2 border-transparent select-none mr-1"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{group.name}</span>
                            </button>
                        )}
                        {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
                            const isActive = activeTab === id;
                            const count = tabCounts[id];
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleTabChange(id)}
                                    className={cn(
                                        "relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 select-none",
                                        isActive
                                            ? "text-primary border-primary"
                                            : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                    {count !== undefined && count > 0 && (
                                        <span className={cn(
                                            "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                                            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                        )}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* ═══ MOBILE BOTTOM TABS ═══ */}
            {!isTownHall && (
                <GroupBottomNav activeTab={activeTab} onTabChange={(id: any) => handleTabChange(id)} />
            )}

            {/* ═══ 3. CONTENT ═══ */}
            <div
                className={cn(
                    activeTab === "town-hall"
                        ? "flex-1 flex flex-col min-h-0"
                        : "max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full"
                )}
            >
                {/* OVERVIEW */}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8 space-y-5">
                            {isPending && (
                                <div className="bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3 rounded-lg">
                                    <Clock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                        <h3 className="text-sm font-bold text-amber-400">Pending Join Request</h3>
                                        <p className="text-xs text-amber-500/80 mt-1">Your request is being reviewed by group managers.</p>
                                    </div>
                                </div>
                            )}

                            {/* Governance Status */}
                            <div
                                className={cn(
                                    "border p-4 flex items-center gap-4 rounded-md shadow-sm",
                                    governanceHealth === "Healthy" ? "bg-card border-border" :
                                        governanceHealth === "Warning" ? "bg-amber-500/5 border-amber-500/30" :
                                            "bg-red-500/5 border-red-500/30"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-10 h-10 flex items-center justify-center shrink-0 border rounded-sm",
                                        governanceHealth === "Healthy" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                            governanceHealth === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                "bg-red-500/10 text-red-500 border-red-500/20"
                                    )}
                                >
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-sm font-semibold text-foreground">
                                            {governanceHealth === "Healthy" ? "Governance Systems Operational" :
                                                governanceHealth === "Warning" ? "Governance Warning" : "Governance Critical"}
                                        </h3>
                                        <span
                                            className={cn(
                                                "text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 border rounded-sm",
                                                governanceHealth === "Healthy" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                    governanceHealth === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                        "bg-red-500/10 text-red-500 border-red-500/20"
                                            )}
                                        >
                                            {governanceHealth}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                                        {governanceHealth === "Healthy"
                                            ? `Majority-vote approval active · ${managerCount} manager${managerCount !== 1 ? "s" : ""}`
                                            : "Group requires at least 2 managers to meet civic standards."}
                                    </p>
                                </div>
                                {governanceHealth !== "Healthy" && (
                                    <Button size="sm" variant="outline" className="shrink-0 text-[10px] h-7 font-mono uppercase" onClick={() => handleTabChange("governance")}>
                                        View Details
                                    </Button>
                                )}
                            </div>

                            {/* About — Editable */}
                            <div className="border border-border bg-card overflow-hidden rounded-md shadow-sm">
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Zap className="w-3.5 h-3.5" /> // DESCRIPTION
                                    </span>
                                    {isManager && !isEditingDescription && (
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1.5 text-muted-foreground hover:text-foreground font-mono uppercase" onClick={startEditDescription}>
                                            [EDIT]
                                        </Button>
                                    )}
                                </div>
                                <div className="p-4 min-h-[160px] relative">
                                    {isEditingDescription ? (
                                        <div className="space-y-3 h-full">
                                            <Textarea
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                className="min-h-[120px] resize-none text-sm font-mono leading-relaxed bg-background border-border focus-visible:ring-1"
                                                placeholder="Describe your community..."
                                            />
                                            <div className="flex items-center justify-between">
                                                <p className="font-mono text-[10px] text-muted-foreground">{editDescription.length} chars</p>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs font-mono uppercase" onClick={() => setIsEditingDescription(false)} disabled={isSaving}>Cancel</Button>
                                                    <Button size="sm" className="h-7 text-xs gap-1 font-mono uppercase" onClick={saveDescription} disabled={isSaving || !editDescription.trim()}>
                                                        {isSaving ? "SAVING..." : "SAVE"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-mono">{group.description}</p>
                                    )}

                                    {(group.tags.length > 0 || isManager) && (
                                        <div className="mt-6 pt-4 border-t border-border/50 border-dashed">
                                            {isEditingTags ? (
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {editTags.map((tag) => (
                                                            <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 bg-primary/5 text-primary border border-primary/20">
                                                                #{tag}
                                                                <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={newTag}
                                                            onChange={(e) => setNewTag(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                                                            placeholder="Add tag…"
                                                            className="h-8 text-xs flex-1 font-mono"
                                                        />
                                                        <Button size="sm" variant="outline" className="h-8 text-xs font-mono uppercase" onClick={addTag} disabled={!newTag.trim()}>
                                                            ADD
                                                        </Button>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs font-mono uppercase" onClick={() => setIsEditingTags(false)} disabled={isSaving}>Cancel</Button>
                                                        <Button size="sm" className="h-7 text-xs gap-1 font-mono uppercase" onClick={saveTags} disabled={isSaving}>
                                                            {isSaving ? "SAVING..." : "SAVE TAGS"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">TAGS:</span>
                                                    {group.tags.map((tag: string) => (
                                                        <span key={tag} className="text-[10px] font-mono px-2 py-1 bg-muted text-muted-foreground border border-border">#{tag}</span>
                                                    ))}
                                                    {isManager && (
                                                        <button
                                                            onClick={startEditTags}
                                                            className="text-[10px] font-mono uppercase px-2 py-1 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                                                        >
                                                            + Edit
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Activity Feed */}
                            <div>
                                <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5" /> // RECENT ACTIVITY
                                </h3>
                                <div className="border border-border divide-y divide-border bg-card rounded-md overflow-hidden shadow-sm">
                                    {members?.slice(0, 5).map((m: any) => (
                                        <ActivityRow key={m._id} member={m} />
                                    ))}
                                    {(!members || members.length === 0) && (
                                        <div className="px-4 py-8 text-center text-xs font-mono text-muted-foreground uppercase">No activity yet</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDEBAR */}
                        <div className="lg:col-span-4 space-y-5">
                            {/* Stats Grid — live data */}
                            <div className="grid grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden shadow-sm">
                                {[
                                    { label: "MEMBERS", value: groupStats?.memberCount ?? liveMemberCount, color: "text-foreground" },
                                    { label: "ONLINE", value: groupStats?.onlineCount ?? 0, color: "text-emerald-500", dot: true },
                                    { label: "EVENTS", value: groupStats?.eventCount ?? groupEvents?.length ?? 0, color: "text-blue-500" },
                                    { label: "MESSAGES", value: groupStats?.messageCount ?? 0, color: "text-purple-500" },
                                ].map((stat) => (
                                    <div key={stat.label} className="bg-card p-4">
                                        <p className="font-mono text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {stat.dot && (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                            <p className={cn("text-xl font-mono font-medium", stat.color)}>{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Info rows */}
                            <div className="border border-border bg-card divide-y divide-border rounded-md overflow-hidden shadow-sm">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">VISIBILITY</span>
                                    <span className="font-mono text-xs font-medium text-foreground">{group.isPublic ? "PUBLIC" : "PRIVATE"}</span>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">FOUNDED BY</span>
                                    <span className="font-mono text-xs font-medium text-foreground">{members?.find((m: any) => m.role === "founder")?.name || "Unknown"}</span>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">APPROVAL</span>
                                    <span className="font-mono text-xs font-medium text-primary">MAJORITY VOTE</span>
                                </div>
                            </div>

                            {/* Managers */}
                            <div className="border border-border bg-card overflow-hidden rounded-md shadow-sm">
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Crown className="w-3.5 h-3.5" /> // MANAGERS
                                    </span>
                                    <button className="font-mono text-[10px] text-primary hover:underline uppercase" onClick={() => handleTabChange("members")}>
                                        [View all]
                                    </button>
                                </div>
                                <div className="divide-y divide-border">
                                    {managers.map((m: any) => (
                                        <div key={m._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                            <ProfileAvatar userId={m.userId} name={m.name} avatarUrl={m.avatarUrl} className="w-7 h-7" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-foreground truncate">{m.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{m.role === "founder" ? "Founder · Manager" : "Manager"}</p>
                                            </div>
                                            {m.role === "founder" && (
                                                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">OWNER</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {governanceHealth !== "Healthy" && isManager && (
                                    <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/30">
                                        <p className="text-[10px] font-bold text-amber-400">⚠ Second Manager Needed</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Required when group has &gt;1 member</p>
                                        <Button size="sm" variant="outline" className="mt-2 h-7 text-[10px] w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                                            + Promote a Member
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Newest Members */}
                            <div className="border border-border bg-card overflow-hidden rounded-md shadow-sm">
                                <div className="px-4 py-3 bg-muted/40 border-b border-border">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" /> // NEWEST MEMBERS
                                    </span>
                                </div>
                                <div className="divide-y divide-border">
                                    {members?.slice(0, 4).map((m: any) => (
                                        <div key={m._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                            <ProfileAvatar userId={m.userId} name={m.name} avatarUrl={m.avatarUrl} className="w-7 h-7" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-foreground truncate">{m.name}</p>
                                                <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
                                            </div>
                                            <span className="w-2 h-2 bg-emerald-400 shrink-0 rounded-full" title="Online" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Events Sidebar */}
                            <div className="border border-border bg-card overflow-hidden rounded-md shadow-sm">
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" /> // UPCOMING EVENTS
                                    </span>
                                    {isManager && (
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 font-mono uppercase" onClick={() => setShowCreateEventDialog(true)}>
                                            + Create
                                        </Button>
                                    )}
                                </div>
                                {groupEvents && groupEvents.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {groupEvents.slice(0, 2).map((event: any) => (
                                            <SidebarEventCard key={event._id} event={event} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-4 py-8 text-center">
                                        <Calendar className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                                        <p className="text-sm font-semibold text-foreground">No events yet</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">Create the first event to put this group on the city map.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TOWN HALL */}
                {activeTab === "town-hall" && (
                    <GroupChatLayout
                        groupId={groupId}
                        initialChannelId={jumpToChannel}
                        highlightMessageId={jumpToMessage}
                        onHighlightDone={handleHighlightDone}
                        onBack={() => handleTabChange("overview")}
                    />
                )}

                {/* EVENTS */}
                {activeTab === "events" && (() => {
                    // ── Calendar helpers (scoped to avoid re-computation when tab is hidden) ──
                    const calYear = calendarMonth.getFullYear();
                    const calMon = calendarMonth.getMonth();
                    const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
                    const firstDayOfWeek = new Date(calYear, calMon, 1).getDay(); // 0 = Sun
                    const calDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                    const prevPadding = Array.from({ length: firstDayOfWeek }, (_, i) => i);

                    // Map events by date key (YYYY-MM-DD) for dot indicators
                    const eventsByDate: Record<string, typeof groupEvents extends (infer T)[] | undefined ? T[] : any[]> = {};
                    (groupEvents ?? []).forEach((ev: any) => {
                        const d = new Date(ev.startTime);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        if (!eventsByDate[key]) eventsByDate[key] = [];
                        eventsByDate[key].push(ev);
                    });

                    const todayKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; })();

                    const selectedDayEvents = selectedCalendarDate ? (eventsByDate[selectedCalendarDate] ?? []) : [];

                    return (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight text-foreground">Community Events</h2>
                                    <p className="text-xs text-muted-foreground uppercase font-mono">Upcoming activities and gatherings</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* View toggle */}
                                    <div className="flex items-center bg-muted/50 border border-border rounded-lg p-0.5">
                                        <button
                                            onClick={() => setEventsView("list")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase transition-all",
                                                eventsView === "list"
                                                    ? "bg-background text-foreground shadow-sm border border-border"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <LayoutList className="w-3.5 h-3.5" /> List
                                        </button>
                                        <button
                                            onClick={() => setEventsView("calendar")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase transition-all",
                                                eventsView === "calendar"
                                                    ? "bg-background text-foreground shadow-sm border border-border"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <CalendarDays className="w-3.5 h-3.5" /> Calendar
                                        </button>
                                    </div>
                                    {isManager && (
                                        <Button size="sm" className="font-mono text-xs uppercase" onClick={() => setShowCreateEventDialog(true)}>
                                            + Create Event
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* ════ LIST VIEW ════ */}
                            {eventsView === "list" && (
                                groupEvents && groupEvents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {groupEvents.map((event: any) => (
                                            <EventCard
                                                key={event._id}
                                                event={event}
                                                userId={myStatus?.userId}
                                                isManager={isManager}
                                                onAttend={handleAttendEvent}
                                                onPay={handlePayForEvent}
                                                onSelect={(e) => router.push(`/community/${groupId}/events/${e._id}`)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center border-2 border-dashed border-border bg-muted/20 rounded-lg">
                                        <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                                        <h3 className="text-lg font-semibold text-foreground">No Upcoming Events</h3>
                                        <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2 mb-6 uppercase font-mono text-[10px]">
                                            Create the first gathering to activate this community
                                        </p>
                                        {isManager && (
                                            <Button variant="outline" className="font-mono text-xs uppercase" onClick={() => setShowCreateEventDialog(true)}>
                                                + Create First Event
                                            </Button>
                                        )}
                                    </div>
                                )
                            )}

                            {/* ════ CALENDAR VIEW ════ */}
                            {eventsView === "calendar" && (
                                <div className="space-y-4">
                                    {/* Month nav */}
                                    <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
                                        <button
                                            onClick={() => setCalendarMonth(new Date(calYear, calMon - 1, 1))}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="text-center">
                                            <h3 className="text-sm font-bold tracking-tight">
                                                {calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    const now = new Date();
                                                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                                                    setSelectedCalendarDate(todayKey);
                                                }}
                                                className="text-[10px] font-mono uppercase text-primary hover:underline"
                                            >
                                                Today
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setCalendarMonth(new Date(calYear, calMon + 1, 1))}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Calendar grid */}
                                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                                        {/* Day headers */}
                                        <div className="grid grid-cols-7 border-b border-border">
                                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                                                <div key={d} className="py-2 text-center text-[10px] font-mono uppercase text-muted-foreground font-bold tracking-wider">
                                                    {d}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Day cells */}
                                        <div className="grid grid-cols-7">
                                            {/* Empty cells for days before the 1st */}
                                            {prevPadding.map((_, i) => (
                                                <div key={`pad-${i}`} className="aspect-square border-b border-r border-border/50 bg-muted/10" />
                                            ))}

                                            {calDays.map((day) => {
                                                const dateKey = `${calYear}-${String(calMon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                                const dayEvents = eventsByDate[dateKey] ?? [];
                                                const isToday = dateKey === todayKey;
                                                const isSelected = dateKey === selectedCalendarDate;
                                                const hasUpcoming = dayEvents.some((e: any) => e.computedStatus === "upcoming" || e.computedStatus === "ongoing");
                                                const hasPast = dayEvents.some((e: any) => e.computedStatus === "completed" || e.computedStatus === "cancelled");

                                                return (
                                                    <button
                                                        key={day}
                                                        onClick={() => setSelectedCalendarDate(isSelected ? null : dateKey)}
                                                        className={cn(
                                                            "aspect-square border-b border-r border-border/50 flex flex-col items-center justify-center gap-1 transition-all relative group/day",
                                                            isSelected
                                                                ? "bg-primary/10 ring-1 ring-primary/30"
                                                                : "hover:bg-muted/30",
                                                            isToday && !isSelected && "bg-primary/5"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "text-sm font-medium tabular-nums",
                                                            isToday && "text-primary font-bold",
                                                            isSelected && "text-primary font-bold",
                                                            !isToday && !isSelected && "text-foreground"
                                                        )}>
                                                            {day}
                                                        </span>
                                                        {dayEvents.length > 0 && (
                                                            <div className="flex gap-0.5">
                                                                {hasUpcoming && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                                                {hasPast && <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />}
                                                            </div>
                                                        )}
                                                        {dayEvents.length > 0 && (
                                                            <span className="absolute top-1 right-1.5 text-[9px] font-mono text-muted-foreground font-bold">
                                                                {dayEvents.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex items-center justify-center gap-4 text-[10px] font-mono uppercase text-muted-foreground">
                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Upcoming</span>
                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Past</span>
                                    </div>

                                    {/* Selected day detail */}
                                    {selectedCalendarDate && (
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-bold tracking-tight flex items-center gap-2">
                                                <CalendarDays className="w-4 h-4 text-primary" />
                                                {new Date(selectedCalendarDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                            </h4>
                                            {selectedDayEvents.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {selectedDayEvents.map((event: any) => (
                                                        <EventCard
                                                            key={event._id}
                                                            event={event}
                                                            userId={myStatus?.userId}
                                                            isManager={isManager}
                                                            onAttend={handleAttendEvent}
                                                            onPay={handlePayForEvent}
                                                            onSelect={(e) => router.push(`/community/${groupId}/events/${e._id}`)}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-8 text-center border border-dashed border-border bg-muted/10 rounded-xl">
                                                    <Calendar className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                                                    <p className="text-xs text-muted-foreground font-mono uppercase">No events on this day</p>
                                                    {isManager && (
                                                        <Button variant="link" size="sm" className="mt-2 text-xs font-mono uppercase" onClick={() => setShowCreateEventDialog(true)}>
                                                            + Create one
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!selectedCalendarDate && (
                                        <p className="text-xs text-center text-muted-foreground font-mono py-2">Tap a date to see events</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* MEMBERS */}
                {activeTab === "members" && (
                    <div className="space-y-4 sm:space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Member Directory</h2>
                                <p className="text-xs sm:text-sm text-muted-foreground">{liveMemberCount} members in {group.name}</p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search members…"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    className="pl-10 h-9 text-sm font-mono"
                                />
                            </div>
                        </div>
                        <div className="border border-border bg-card divide-y divide-border rounded-md overflow-hidden shadow-sm">
                            {filteredMembers.map((member: any) => (
                                <MemberRow
                                    key={member._id}
                                    member={member}
                                    isManager={!!isManager}
                                    onPromote={async (userId) => {
                                        try {
                                            await updateMemberRole({ groupId, targetUserId: userId, role: "manager" });
                                            toast.success("Member promoted to Manager");
                                        } catch (e: any) {
                                            toast.error(e.message || "Failed to promote member");
                                        }
                                    }}
                                    onRemove={async (userId) => {
                                        try {
                                            await removeMember({ groupId, targetUserId: userId });
                                            toast.success("Member removed");
                                        } catch (e: any) {
                                            toast.error(e.message || "Failed to remove member");
                                        }
                                    }}
                                />
                            ))}
                            {filteredMembers.length === 0 && (
                                <div className="px-4 py-12 text-center text-xs font-mono text-muted-foreground uppercase">
                                    {memberSearch ? "No members match your search" : "No members yet"}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* GOVERNANCE */}
                {activeTab === "governance" && <GroupGovernance groupId={groupId} onJumpToMessage={handleJumpToMessage} />}

                {/* LOGS */}
                {activeTab === "logs" && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                                <History className="w-5 h-5" /> Activity Logs
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Complete governance history and group activity</p>
                        </div>

                        {!governanceLogs ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex gap-3 p-4 border border-border rounded-md bg-card">
                                        <Skeleton className="w-8 h-8 rounded-sm shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-3 w-3/4" />
                                            <Skeleton className="h-2.5 w-1/3" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : governanceLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border bg-muted/20 rounded-lg">
                                <History className="w-12 h-12 text-muted-foreground/15 mb-3" />
                                <p className="text-sm font-mono font-bold uppercase text-muted-foreground">No Activity Yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Governance actions will appear here</p>
                            </div>
                        ) : (() => {
                            const displayedLogs = showAllLogs ? governanceLogs : governanceLogs.slice(0, 15);
                            const hasMore = governanceLogs.length > 15;
                            return (
                                <div className="space-y-3">
                                    <div className="border border-border rounded-md bg-card overflow-hidden divide-y divide-border">
                                        {displayedLogs.map((log: any) => {
                                            const actionConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string; description: string }> = {
                                                promotion: { icon: <ArrowUp className="w-3.5 h-3.5" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20", label: "Member Promoted", description: "was promoted to manager" },
                                                demotion: { icon: <ArrowDown className="w-3.5 h-3.5" />, color: "text-orange-500", bgColor: "bg-orange-500/10 border-orange-500/20", label: "Member Demoted", description: "was demoted to member" },
                                                removal: { icon: <UserX className="w-3.5 h-3.5" />, color: "text-red-500", bgColor: "bg-red-500/10 border-red-500/20", label: "Member Removed", description: "was removed from the group" },
                                                transfer_founder: { icon: <Shield className="w-3.5 h-3.5" />, color: "text-purple-500", bgColor: "bg-purple-500/10 border-purple-500/20", label: "Founder Transfer", description: "transferred founder role to" },
                                                vote_resolution_approved: { icon: <Check className="w-3.5 h-3.5" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20", label: "Vote Approved", description: "approved by vote" },
                                                vote_resolution_rejected: { icon: <X className="w-3.5 h-3.5" />, color: "text-red-500", bgColor: "bg-red-500/10 border-red-500/20", label: "Vote Rejected", description: "rejected by vote" },
                                                join: { icon: <LogIn className="w-3.5 h-3.5" />, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/20", label: "Member Joined", description: "joined the group" },
                                                leave: { icon: <LogOut className="w-3.5 h-3.5" />, color: "text-gray-500", bgColor: "bg-gray-500/10 border-gray-500/20", label: "Member Left", description: "left the group" },
                                                create_fund: { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20", label: "Fund Created", description: "created a community fund" },
                                                settings: { icon: <Settings className="w-3.5 h-3.5" />, color: "text-purple-500", bgColor: "bg-purple-500/10 border-purple-500/20", label: "Settings Changed", description: "updated group settings" },
                                            };
                                            const config = actionConfig[log.actionType] || {
                                                icon: <Activity className="w-3.5 h-3.5" />,
                                                color: "text-muted-foreground",
                                                bgColor: "bg-muted/50 border-border",
                                                label: log.actionType || "Unknown",
                                                description: "performed an action",
                                            };

                                            const timeAgo = (() => {
                                                const diff = Date.now() - log.createdAt;
                                                const mins = Math.floor(diff / 60000);
                                                if (mins < 1) return "just now";
                                                if (mins < 60) return `${mins}m ago`;
                                                const hrs = Math.floor(mins / 60);
                                                if (hrs < 24) return `${hrs}h ago`;
                                                const days = Math.floor(hrs / 24);
                                                if (days < 30) return `${days}d ago`;
                                                return new Date(log.createdAt).toLocaleDateString();
                                            })();

                                            return (
                                                <div
                                                    key={log._id}
                                                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group/row cursor-pointer"
                                                    onClick={() => setSelectedLog({ ...log, config, timeAgo })}
                                                >
                                                    <div className={cn("w-8 h-8 rounded-sm border flex items-center justify-center shrink-0 mt-0.5", config.bgColor, config.color)}>
                                                        {config.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-foreground">
                                                                    <span className="font-bold">{log.actorName || "System"}</span>
                                                                    <span className="text-muted-foreground font-normal"> {log.targetName ? `${config.description.split(" ")[0]} ` : config.description}</span>
                                                                    {log.targetName && <span className="font-bold">{log.targetName}</span>}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <Badge variant="outline" className={cn("text-[8px] uppercase font-mono h-4 px-1.5", config.color, config.bgColor)}>
                                                                        {config.label}
                                                                    </Badge>
                                                                    <span className="text-[10px] text-muted-foreground/50 font-mono">{timeAgo}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0 mt-1">
                                                                {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {hasMore && (
                                        <Button
                                            variant="outline"
                                            className="w-full h-9 text-xs font-mono uppercase gap-2"
                                            onClick={() => setShowAllLogs(!showAllLogs)}
                                        >
                                            <History className="w-3.5 h-3.5" />
                                            {showAllLogs ? `Show Recent (15)` : `View All (${governanceLogs.length})`}
                                        </Button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* ═══ LOG DETAIL DRAWER ═══ */}
            <Drawer open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DrawerContent>
                    {selectedLog && (() => {
                        const revertMap: Record<string, string> = {
                            promotion: "revert_promotion",
                            demotion: "revert_demotion",
                            removal: "revert_removal",
                        };
                        const revertAction = revertMap[selectedLog.actionType];
                        const revertLabels: Record<string, string> = {
                            revert_promotion: "Propose Demotion (Revert)",
                            revert_demotion: "Propose Promotion (Revert)",
                            revert_removal: "Propose Re-admission (Revert)",
                        };

                        return (
                            <>
                                <DrawerHeader className="border-b border-border">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-10 h-10 rounded-sm border flex items-center justify-center shrink-0", selectedLog.config.bgColor, selectedLog.config.color)}>
                                            {selectedLog.config.icon}
                                        </div>
                                        <div>
                                            <DrawerTitle className="text-sm font-mono font-bold uppercase tracking-tight">
                                                {selectedLog.config.label}
                                            </DrawerTitle>
                                            <DrawerDescription className="text-[10px] font-mono uppercase text-muted-foreground">
                                                {selectedLog.timeAgo} • {new Date(selectedLog.createdAt).toLocaleString()}
                                            </DrawerDescription>
                                        </div>
                                    </div>
                                </DrawerHeader>

                                <div className="p-4 space-y-4 overflow-y-auto">
                                    {/* Action Summary */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Action Summary</h4>
                                        <div className="bg-muted/30 border border-border rounded-md p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-mono uppercase text-muted-foreground">Type</span>
                                                <Badge variant="outline" className={cn("text-[8px] uppercase font-mono h-4 px-1.5", selectedLog.config.color, selectedLog.config.bgColor)}>
                                                    {selectedLog.config.label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-mono uppercase text-muted-foreground">Performed By</span>
                                                <span className="text-xs font-bold">{selectedLog.actorName || "System"}</span>
                                            </div>
                                            {selectedLog.targetName && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Target</span>
                                                    <span className="text-xs font-bold">{selectedLog.targetName}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-mono uppercase text-muted-foreground">Timestamp</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                    {new Date(selectedLog.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details (if any) */}
                                    {selectedLog.details && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Details</h4>
                                            <div className="bg-muted/30 border border-border rounded-md p-3">
                                                <p className="text-xs text-foreground whitespace-pre-wrap">{selectedLog.details}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Description */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Description</h4>
                                        <p className="text-xs text-muted-foreground">
                                            <span className="font-semibold text-foreground">{selectedLog.actorName || "System"}</span>{" "}
                                            {selectedLog.config.description}{" "}
                                            {selectedLog.targetName && <span className="font-semibold text-foreground">{selectedLog.targetName}</span>}
                                        </p>
                                    </div>
                                </div>

                                <DrawerFooter className="border-t border-border">
                                    {revertAction && isManager && (
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 font-mono text-xs uppercase"
                                            onClick={async () => {
                                                try {
                                                    await proposeAction({
                                                        groupId,
                                                        targetUserId: selectedLog.targetUserId,
                                                        actionType: revertAction as any,
                                                        reason: `Revert: ${selectedLog.config.label} of ${selectedLog.targetName || "member"}`,
                                                    });
                                                    toast.success("Revert proposal created! Managers will vote on it.");
                                                    setSelectedLog(null);
                                                } catch (e: any) {
                                                    toast.error(e.message || "Failed to propose revert");
                                                }
                                            }}
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            {revertLabels[revertAction] || "Propose Revert"}
                                        </Button>
                                    )}
                                    <DrawerClose asChild>
                                        <Button variant="ghost" className="w-full font-mono text-xs uppercase">Close</Button>
                                    </DrawerClose>
                                </DrawerFooter>
                            </>
                        );
                    })()}
                </DrawerContent>
            </Drawer>

            {/* ═══ DIALOGS ═══ */}

            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request to Join</DialogTitle>
                        <DialogDescription>Tell the managers why you&apos;d like to join {group.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Textarea
                            placeholder="I'm interested because…"
                            value={joinMessage}
                            onChange={(e) => setJoinMessage(e.target.value)}
                            maxLength={300}
                            className="min-h-25 resize-none"
                        />
                        <p className="text-xs text-muted-foreground text-right">{joinMessage.length}/300</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
                        <Button onClick={executeJoin} disabled={isJoining}>
                            {isJoining ? "Sending..." : "Send Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
                <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
                    <DialogHeader className="px-5 pt-5 pb-3">
                        <DialogTitle className="font-mono text-sm uppercase tracking-tight flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            Create Community Event
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">Organize an activity for {group.name}</DialogDescription>
                    </DialogHeader>

                    <div className="px-5 pb-5 space-y-4">
                        {/* Event Type Toggle */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Event Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setEventForm({ ...eventForm, eventType: "in-person" })}
                                    className={cn(
                                        "flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium transition-all",
                                        eventForm.eventType === "in-person"
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-border bg-card text-muted-foreground hover:border-primary/30"
                                    )}
                                >
                                    <MapPinIcon className="w-4 h-4" /> In Person
                                </button>
                                <button
                                    onClick={() => setEventForm({ ...eventForm, eventType: "online" })}
                                    className={cn(
                                        "flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium transition-all",
                                        eventForm.eventType === "online"
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-border bg-card text-muted-foreground hover:border-primary/30"
                                    )}
                                >
                                    <Video className="w-4 h-4" /> Online
                                </button>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Event Title *</label>
                            <Input
                                placeholder={eventForm.eventType === "online" ? "e.g. Community Town Hall" : "e.g. Weekend Park Cleanup"}
                                value={eventForm.title}
                                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                                className="text-sm"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                            <Textarea
                                placeholder="What's happening? Share details, agenda, what to bring..."
                                value={eventForm.description}
                                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                className="text-sm min-h-[72px] resize-none"
                            />
                        </div>

                        {/* Date & Location row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Date & Time *</label>
                                <Input
                                    type="datetime-local"
                                    value={eventForm.startTime}
                                    onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                                    className="text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                                    {eventForm.eventType === "online" ? "Meeting Link" : "Location"} *
                                </label>
                                {eventForm.eventType === "online" ? (
                                    <Input
                                        placeholder="https://meet.google.com/..."
                                        value={eventForm.location}
                                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                                        className="text-sm"
                                    />
                                ) : (
                                    <PlaceAutocomplete
                                        placeholder="Search location..."
                                        value={eventForm.location}
                                        onChange={(value) => setEventForm({ ...eventForm, location: value })}
                                        onPlaceSelect={(feature) => {
                                            const [lon, lat] = feature.geometry.coordinates;
                                            setEventForm((prev) => ({
                                                ...prev,
                                                location: [feature.properties.name, feature.properties.city, feature.properties.state].filter(Boolean).join(", "),
                                                locationCoords: { lat, lon },
                                            }));
                                        }}
                                        className="text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Paid Event Toggle */}
                        <div className="flex items-center justify-between p-3 border border-border bg-muted/30 rounded-md">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold">Paid Event</p>
                                <p className="text-[10px] text-muted-foreground">Collect payments via Razorpay</p>
                            </div>
                            <input type="checkbox" checked={eventForm.isPaid} onChange={(e) => setEventForm({ ...eventForm, isPaid: e.target.checked })} className="w-4 h-4 rounded" />
                        </div>

                        {eventForm.isPaid && (
                            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Price (₹)</label>
                                    <Input type="number" placeholder="499" value={eventForm.price || ""} onChange={(e) => setEventForm({ ...eventForm, price: Number(e.target.value) })} className="text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Capacity</label>
                                    <Input type="number" placeholder="50" value={eventForm.capacity || ""} onChange={(e) => setEventForm({ ...eventForm, capacity: Number(e.target.value) })} className="text-sm" />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-5 py-3 bg-muted/30 border-t border-border">
                        <Button variant="ghost" size="sm" className="text-xs font-mono uppercase" onClick={() => setShowCreateEventDialog(false)}>Cancel</Button>
                        <Button
                            size="sm"
                            className="text-xs font-mono uppercase gap-1.5"
                            disabled={isCreatingEvent || !eventForm.title || !eventForm.startTime || !eventForm.location}
                            onClick={handleCreateEvent}
                        >
                            {isCreatingEvent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {isCreatingEvent ? "Creating..." : "Create Event"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

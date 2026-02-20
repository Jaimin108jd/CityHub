"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    Activity,
    MoreVertical,
    Share2,
    Search,
    Eye,
    X,
    Check,
    Image as ImageIcon,
    Loader2,
    MessageSquare,
    Calendar,
    Shield,
    History
} from "lucide-react";
import { GroupBottomNav } from "./GroupBottomNav"; // Assuming this might need adjustment or removal if it links to removed tabs
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
import { ProfileAvatar } from "@/components/ProfileAvatar";

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
    const [jumpToChannel, setJumpToChannel] = useState<Id<"channels"> | null>(null);
    const [jumpToMessage, setJumpToMessage] = useState<Id<"messages"> | null>(null);
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
    const [isUploadingCover, setIsUploadingCover] = useState(false);

    const [activeTab, setActiveTab] = useState<TabId>(
        (searchParams.get("tab") as TabId) || "overview"
    );

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

    const handleJumpToMessage = useCallback((channelId: Id<"channels">, messageId: Id<"messages">) => {
        setJumpToChannel(channelId);
        setJumpToMessage(messageId);
        handleTabChange("town-hall");
    }, [handleTabChange]);

    // ── Data — conditional fetching for performance ──
    const group = useQuery(api.groups.getGroup, isAuthenticated ? { groupId } : "skip");
    const members = useQuery(api.groups.getGroupMembers, isAuthenticated ? { groupId } : "skip");
    const myStatus = useQuery(api.groups.getMyJoinRequestStatus, isAuthenticated ? { groupId } : "skip");
    const groupStats = useQuery(api.groups.getGroupStats, isAuthenticated ? { groupId } : "skip");

    // ── Mutations (stable references via hooks) ──
    const updateGroupMut = useMutation(api.groups.updateGroup);
    const requestToJoin = useMutation(api.groups.requestToJoin);
    const leaveGroup = useMutation(api.groups.leaveGroup);
    const updateMemberRole = useMutation(api.groups.updateMemberRole);
    const removeMember = useMutation(api.groups.removeMember);
    const generateUploadUrl = useMutation(api.groups.generateUploadUrl);

    const coverInputRef = useRef<HTMLInputElement>(null);

    // ── Derived state (memoized to avoid recalc on every render) ──
    const isManager = myStatus?.status === "member" && (myStatus.role === "manager" || myStatus.role === "founder");
    const isMember = myStatus?.status === "member";
    const isPending = myStatus?.status === "pending";

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
            members: members?.length,
        }),
        [members?.length]
    );

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
        <div className="bg-background flex flex-col min-h-dvh lg:min-h-screen pb-20">
            {/* ═══ 1. FULL-BLEED HEADER ═══ */}
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

            {/* ═══ 2. STICKY TAB BAR (Desktop) ═══ */}
            <div className="sticky top-12 md:top-0 z-40 bg-card border-b border-border shrink-0 hidden md:block">
                <div className="mx-auto px-2 sm:px-6 lg:px-8 max-w-6xl">
                    <nav className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px" aria-label="Tabs">
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
            <GroupBottomNav activeTab={activeTab} onTabChange={(id: any) => handleTabChange(id)} />

            {/* ═══ 3. CONTENT ═══ */}
            <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
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

                            {/* About — Editable */}
                            <div className="border border-border bg-card overflow-hidden rounded-md shadow-sm">
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Eye className="w-3.5 h-3.5" /> // DESCRIPTION
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
                        </div>
                    </div>
                )}

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

                {/* TOWN HALL PLACEHOLDER */}
                {activeTab === "town-hall" && (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-4 bg-card border border-border rounded-md shadow-sm">
                        <MessageSquare className="w-12 h-12 text-muted-foreground/50" />
                        <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-foreground">Town Hall</h2>
                        <p className="text-muted-foreground text-sm max-w-md font-mono">To be built.</p>
                    </div>
                )}

                {/* EVENTS PLACEHOLDER */}
                {activeTab === "events" && (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-4 bg-card border border-border rounded-md shadow-sm">
                        <Calendar className="w-12 h-12 text-muted-foreground/50" />
                        <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-foreground">Events</h2>
                        <p className="text-muted-foreground text-sm max-w-md font-mono">To be built.</p>
                    </div>
                )}

                {/* GOVERNANCE */}
                {activeTab === "governance" && (
                    <GroupGovernance groupId={groupId} onJumpToMessage={handleJumpToMessage} />
                )}

                {/* LOGS PLACEHOLDER */}
                {activeTab === "logs" && (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-4 bg-card border border-border rounded-md shadow-sm">
                        <History className="w-12 h-12 text-muted-foreground/50" />
                        <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-foreground">Logs</h2>
                        <p className="text-muted-foreground text-sm max-w-md font-mono">To be built.</p>
                    </div>
                )}
            </div>

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
        </div>
    );
}

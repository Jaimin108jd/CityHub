"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MessageSquare, Loader2, Hash, Volume2, Plus, MoreHorizontal, Pencil, Trash, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageArea } from "./MessageArea";

import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHoverCard } from "../UserHoverCard";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileChatHeader } from "./mobile/chatHeader";
import { SwipeableTabs } from "./mobile/swipeableTabs";
import { MobileChannelList } from "./mobile/mobileChannelList";
import { MobileMemberList } from "./mobile/mobileMemberList";
import { MobileBottomBar } from "./mobile/bottomNav";

interface GroupChatLayoutProps {
    groupId: Id<"groups">;
    initialChannelId?: Id<"channels"> | null;
    highlightMessageId?: Id<"messages"> | null;
    onHighlightDone?: () => void;
    onBack?: () => void;
}

type Tab = "channels" | "chat" | "members";

export function GroupChatLayout({ groupId, initialChannelId, highlightMessageId, onHighlightDone, onBack }: GroupChatLayoutProps) {
    const channels = useQuery(api.channels.listChannels, { groupId });
    const subscriptions = useQuery(api.channels.getAllChannelSubscriptions, { groupId });
    const createChannel = useMutation(api.channels.createChannel);
    const toggleMute = useMutation(api.channels.toggleChannelMute);
    const myMembership = useQuery(api.groups.getMyJoinRequestStatus, { groupId });
    const members = useQuery(api.groups.getGroupMembers, { groupId });
    const onlineUserIds = useQuery(api.groups.getOnlineMembers, { groupId });
    const updateChannel = useMutation(api.channels.updateChannel);
    const deleteChannel = useMutation(api.channels.deleteChannel);

    const onlineSet = useMemo(() => new Set(onlineUserIds ?? []), [onlineUserIds]);

    const [selectedChannelId, setSelectedChannelId] = useState<Id<"channels"> | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("channels");

    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [channelToEdit, setChannelToEdit] = useState<any>(null);
    const [editName, setEditName] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [channelToDelete, setChannelToDelete] = useState<Id<"channels"> | null>(null);

    const isManager = myMembership?.role === "manager" || myMembership?.role === "founder";
    const isMember = myMembership?.status === "member";
    const selectedChannel = channels?.find((c) => c._id === selectedChannelId);

    const isChannelMuted = (channelId: Id<"channels">) =>
        subscriptions?.some((s) => s.channelId === channelId && s.isMuted) ?? false;

    const mutedChannelIds = useMemo(() => {
        if (!subscriptions) return new Set<Id<"channels">>();
        return new Set(subscriptions.filter(s => s.isMuted).map(s => s.channelId));
    }, [subscriptions]);

    useEffect(() => {
        if (initialChannelId && channels?.some(c => c._id === initialChannelId)) {
            setSelectedChannelId(initialChannelId);
        } else if (channels && channels.length > 0 && !selectedChannelId) {
            setSelectedChannelId(channels[0]._id);
        }
    }, [channels, selectedChannelId, initialChannelId]);

    const handleChannelSelect = (channelId: Id<"channels">) => {
        setSelectedChannelId(channelId);
        setActiveTab("chat");
    };

    const handleToggleMute = async (channelId: Id<"channels">) => {
        try { await toggleMute({ channelId }); toast.success("Notifications updated"); }
        catch { toast.error("Failed to update settings"); }
    };

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        setIsCreating(true);
        try {
            await createChannel({ groupId, name: newChannelName });
            setNewChannelName(""); setShowCreateChannel(false);
            toast.success("Channel created");
        } catch { toast.error("Failed to create channel"); }
        finally { setIsCreating(false); }
    };

    const handleUpdateChannel = async () => {
        if (!channelToEdit || !editName.trim()) return;
        setIsEditing(true);
        try {
            await updateChannel({ channelId: channelToEdit._id, name: editName });
            setChannelToEdit(null); toast.success("Channel updated");
        } catch { toast.error("Failed to update channel"); }
        finally { setIsEditing(false); }
    };

    const confirmDeleteChannel = async () => {
        if (!channelToDelete) return;
        try {
            await deleteChannel({ channelId: channelToDelete });
            if (selectedChannelId === channelToDelete) {
                const remaining = channels?.filter(c => c._id !== channelToDelete);
                setSelectedChannelId(remaining?.[0]?._id ?? null);
            }
            setChannelToDelete(null); toast.success("Channel deleted");
        } catch { toast.error("Failed to delete channel"); }
    };

    if (channels === undefined || members === undefined) {
        return (
            <div className="flex flex-col h-dvh bg-background items-center justify-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col md:flex-row flex-1 bg-background relative overflow-hidden", "h-full min-h-0")}>

            {/* ─── DESKTOP LEFT SIDEBAR ─── */}
            <div className="hidden md:flex flex-col w-55 bg-card/60 border-r border-border/60 shrink-0 h-full">
                <div className="h-12 flex items-center px-4 border-b border-border/60 shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Channels</span>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                        {channels?.map((channel) => (
                            <div key={channel._id} className="relative group px-1">
                                <button
                                    onClick={() => setSelectedChannelId(channel._id)}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all",
                                        selectedChannelId === channel._id
                                            ? "bg-primary/10 text-primary font-semibold"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                    )}
                                >
                                    <span className={cn("shrink-0", selectedChannelId === channel._id ? "text-primary" : "text-muted-foreground/60")}>
                                        {channel.isManagerOnlyPost ? <Volume2 className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                                    </span>
                                    <span className="truncate">{channel.name}</span>
                                </button>
                                {isManager && channel.type === "custom" && (
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg">
                                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36 rounded-xl shadow-lg">
                                                <DropdownMenuItem onClick={() => { setChannelToEdit(channel); setEditName(channel.name); }} className="rounded-lg cursor-pointer gap-2">
                                                    <Pencil className="w-3.5 h-3.5" /> Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setChannelToDelete(channel._id)} className="rounded-lg cursor-pointer gap-2 text-destructive focus:text-destructive">
                                                    <Trash className="w-3.5 h-3.5" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {isManager && (
                        <div className="p-3 border-t border-border/60">
                            <Button variant="outline" size="sm" className="w-full gap-2 rounded-xl border-dashed text-muted-foreground hover:text-foreground" onClick={() => setShowCreateChannel(true)}>
                                <Plus className="w-4 h-4" /> Add Channel
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── MOBILE LAYOUT ─── */}
            <div className="flex flex-col flex-1 min-w-0 h-full md:hidden">
                {/* SwipeableTabs wraps all 3 panels */}
                <SwipeableTabs activeTab={activeTab} onTabChange={setActiveTab}>
                    {/* Panel 0: Channels */}
                    <MobileChannelList
                        channels={channels}
                        selectedChannelId={selectedChannelId}
                        onSelect={handleChannelSelect}
                        isManager={isManager && isMember}
                        mutedChannelIds={mutedChannelIds}
                        onCreateChannel={() => setShowCreateChannel(true)}
                        onEditChannel={(ch) => { setChannelToEdit(ch); setEditName(ch.name); }}
                        onDeleteChannel={setChannelToDelete}
                    />

                    {/* Panel 1: Chat */}
                    <div className="flex flex-col h-full">
                        {selectedChannelId && selectedChannel ? (
                            <>
                                <MobileChatHeader
                                    channelName={selectedChannel.name}
                                    isManagerOnly={selectedChannel.isManagerOnlyPost}
                                    isMuted={isChannelMuted(selectedChannelId)}
                                    onToggleMute={() => handleToggleMute(selectedChannelId)}
                                    onOpenMembers={() => setActiveTab("members")}
                                    onBack={onBack}
                                    memberCount={members.length}
                                />
                                <MessageArea
                                    channelId={selectedChannelId}
                                    groupId={groupId}
                                    channelName={selectedChannel.name}
                                    isManagerOnly={selectedChannel.isManagerOnlyPost}
                                    isMuted={isChannelMuted(selectedChannelId)}
                                    onToggleMute={() => handleToggleMute(selectedChannelId)}
                                    canManage={isManager && isMember}
                                    highlightMessageId={selectedChannelId === initialChannelId ? highlightMessageId : null}
                                    onHighlightDone={onHighlightDone}
                                />
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6">
                                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-foreground">No channel selected</p>
                                    <p className="text-sm text-muted-foreground mt-1">Swipe right or tap Channels to pick one</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel 2: Members */}
                    <MobileMemberList members={members} onlineSet={onlineSet} />
                </SwipeableTabs>

                {/* Sticky tab indicator dots */}

                <MobileBottomBar activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* ─── DESKTOP MAIN CHAT ─── */}
            <div className="hidden md:flex flex-1 flex-col min-w-0 bg-background h-full">
                {selectedChannelId && selectedChannel ? (
                    <>
                        <div className="h-12 flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm border-b border-border/60 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg", selectedChannel.isManagerOnlyPost ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground")}>
                                    {selectedChannel.isManagerOnlyPost ? <Volume2 className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                                </div>
                                <span className="font-semibold text-sm text-foreground">{selectedChannel.name}</span>
                            </div>
                        </div>
                        <MessageArea
                            channelId={selectedChannelId} groupId={groupId}
                            channelName={selectedChannel.name}
                            isManagerOnly={selectedChannel.isManagerOnlyPost}
                            isMuted={isChannelMuted(selectedChannelId)}
                            onToggleMute={() => handleToggleMute(selectedChannelId)}
                            canManage={isManager && isMember}
                            highlightMessageId={selectedChannelId === initialChannelId ? highlightMessageId : null}
                            onHighlightDone={onHighlightDone}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col gap-3">
                        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                        <p className="text-muted-foreground text-sm">Select a channel to start chatting</p>
                    </div>
                )}
            </div>

            {/* ─── DESKTOP RIGHT SIDEBAR ─── */}
            <div className="hidden lg:flex flex-col w-60 border-l border-border/60 bg-card/40 shrink-0 h-full">
                <div className="px-4 h-12 flex items-center justify-between border-b border-border/60 shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Members</span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{members.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin space-y-4">
                    {/* Group by role: founders/managers first, then members */}
                    {(() => {
                        const leaders = members.filter((m: any) => m.role === "founder" || m.role === "manager");
                        const regulars = members.filter((m: any) => m.role === "member");
                        return (
                            <>
                                {leaders.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-2 mb-1.5">
                                            Staff — {leaders.length}
                                        </p>
                                        <div className="space-y-0.5">
                                            {leaders.map((member: any) => {
                                                const isOnline = onlineSet.has(member.userId);
                                                return (
                                                    <UserHoverCard key={member.userId} userId={member.userId} name={member.name}
                                                        avatarUrl={member.avatarUrl} role={member.role} joinedAt={member.joinedAt}
                                                        bio={member.bio} city={member.city} side="left">
                                                        <div className={cn(
                                                            "flex items-center gap-2.5 px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group/member",
                                                            !isOnline && "opacity-50"
                                                        )}>
                                                            <div className="relative shrink-0">
                                                                <Avatar className="w-8 h-8">
                                                                    <AvatarImage src={member.avatarUrl} />
                                                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{member.name[0]}</AvatarFallback>
                                                                </Avatar>
                                                                <span className={cn(
                                                                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 border-[2.5px] border-card rounded-full",
                                                                    isOnline ? "bg-emerald-500" : "bg-zinc-500"
                                                                )} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[13px] font-medium truncate text-foreground group-hover/member:text-primary transition-colors">{member.name}</span>
                                                                    {member.role === "founder" && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                                                    {member.role === "manager" && <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </UserHoverCard>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {regulars.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-2 mb-1.5">
                                            Members — {regulars.length}
                                        </p>
                                        <div className="space-y-0.5">
                                            {regulars.map((member: any) => {
                                                const isOnline = onlineSet.has(member.userId);
                                                return (
                                                    <UserHoverCard key={member.userId} userId={member.userId} name={member.name}
                                                        avatarUrl={member.avatarUrl} role={member.role} joinedAt={member.joinedAt}
                                                        bio={member.bio} city={member.city} side="left">
                                                        <div className={cn(
                                                            "flex items-center gap-2.5 px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group/member",
                                                            !isOnline && "opacity-50"
                                                        )}>
                                                            <div className="relative shrink-0">
                                                                <Avatar className="w-8 h-8">
                                                                    <AvatarImage src={member.avatarUrl} />
                                                                    <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{member.name[0]}</AvatarFallback>
                                                                </Avatar>
                                                                <span className={cn(
                                                                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 border-[2.5px] border-card rounded-full",
                                                                    isOnline ? "bg-emerald-500" : "bg-zinc-500"
                                                                )} />
                                                            </div>
                                                            <span className="text-[13px] font-medium truncate text-foreground/80 group-hover/member:text-foreground transition-colors">{member.name}</span>
                                                        </div>
                                                    </UserHoverCard>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* ─── Dialogs ─── */}
            <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Create Channel</DialogTitle>
                        <DialogDescription>Add a new channel for your group.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Channel Name</Label>
                        <Input placeholder="e.g. general, announcements" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} className="rounded-xl" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateChannel(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreateChannel} disabled={isCreating || !newChannelName.trim()} className="rounded-xl">
                            {isCreating ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!channelToEdit} onOpenChange={(open) => !open && setChannelToEdit(null)}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader><DialogTitle>Rename Channel</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Channel Name</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChannelToEdit(null)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleUpdateChannel} disabled={isEditing || !editName.trim()} className="rounded-xl">
                            {isEditing ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!channelToDelete} onOpenChange={(open) => !open && setChannelToDelete(null)}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Delete Channel</DialogTitle>
                        <DialogDescription>This will permanently delete the channel and all its messages.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChannelToDelete(null)} className="rounded-xl">Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteChannel} className="rounded-xl">Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
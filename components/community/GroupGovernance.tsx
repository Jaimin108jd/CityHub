"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import React, { useState } from "react";
import {
    Shield,
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    Users,
    MoreVertical,
    X,
    Check,
    History,
    TrendingUp,
    Plus,
    Clock,
    Vote,
    Gavel,
    UserMinus,
    UserX,
    ArrowDown,
    ArrowUp,
    LogIn,
    LogOut,
    Settings,
    RotateCcw,
    Loader2,
    FileText,
    RefreshCw,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
    Activity,
    ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/ProfileAvatar";

interface GroupGovernanceProps {
    groupId: Id<"groups">;
    onJumpToMessage?: (channelId: Id<"channels">, messageId: Id<"messages">) => void;
}

export function GroupGovernance({ groupId, onJumpToMessage }: GroupGovernanceProps) {
    const { isAuthenticated } = useConvexAuth();

    // Queries
    const me = useQuery(api.users.getMyProfile);
    const group = useQuery(api.groups.getGroup, isAuthenticated ? { groupId } : "skip");
    const members = useQuery(api.groups.getGroupMembers, isAuthenticated ? { groupId } : "skip");
    const myStatus = useQuery(api.groups.getMyJoinRequestStatus, isAuthenticated ? { groupId } : "skip");
    const joinRequests = useQuery(api.groups.getJoinRequests, isAuthenticated ? { groupId } : "skip");
    const funds = useQuery(api.funds.getGroupFunds, isAuthenticated ? { groupId } : "skip");
    const autoModStatus = useQuery(api.ai.getAutoModStatus, isAuthenticated ? { groupId } : "skip");

    // Mutations
    const handleJoinRequest = useMutation(api.groups.handleJoinRequest);
    const liftTimeout = useMutation(api.ai.liftTimeout);
    const updateMemberRole = useMutation(api.groups.updateMemberRole);
    const removeMember = useMutation(api.groups.removeMember);
    const transferFounder = useMutation(api.groups.transferFounder);
    const castVote = useMutation(api.groups.castVote);
    const createFund = useMutation(api.funds.createFund);
    const proposeAction = useMutation(api.groups.proposeAction);
    const voteOnProposal = useMutation(api.groups.voteOnProposal);

    // Governance data
    const activeProposals = useQuery(api.groups.getActiveProposals, isAuthenticated ? { groupId } : "skip");
    const governanceLogs = useQuery(api.groups.getGovernanceLogs, isAuthenticated ? { groupId } : "skip");
    const governanceHealthData = useQuery(api.groups.getGovernanceHealth, isAuthenticated ? { groupId } : "skip");
    const activeReconfirmations = useQuery(api.groups.getActiveReconfirmations, isAuthenticated ? { groupId } : "skip");
    const resolvedProposals = useQuery(api.groups.getResolvedProposals, isAuthenticated ? { groupId } : "skip");

    // New Mutations
    const createPolicyProposal = useMutation(api.groups.createPolicyProposal);
    const triggerReconfirmation = useMutation(api.groups.triggerReconfirmation);
    const voteOnReconfirmation = useMutation(api.groups.voteOnReconfirmation);


    // Payment Actions
    const createOrder = useAction(api.payments.createOrder);
    const verifyPayment = useAction(api.payments.verifyPayment);

    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
    const [liftingTimeoutId, setLiftingTimeoutId] = useState<string | null>(null);
    const [showCreateFundDialog, setShowCreateFundDialog] = useState(false);
    const [isCreatingFund, setIsCreatingFund] = useState(false);
    const [fundForm, setFundForm] = useState({
        title: "",
        description: "",
        targetAmount: 0,
    });
    const [proposalTarget, setProposalTarget] = useState<{ userId: string; name: string; action: "demote" | "kick" | "promote" | "revert_promotion" | "revert_demotion" | "revert_removal" } | null>(null);
    const [proposalReason, setProposalReason] = useState("");
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [logFilter, setLogFilter] = useState<string>("all");
    const [showPolicyDialog, setShowPolicyDialog] = useState(false);
    const [policyForm, setPolicyForm] = useState({
        actionType: "custom" as "approve_fund" | "change_visibility" | "amend_description" | "custom",
        title: "",
        description: "",
        payload: {} as any,
    });
    const [showResolvedProposals, setShowResolvedProposals] = useState(false);

    // Derived State
    const isManager = myStatus?.status === "member" && (myStatus.role === "manager" || myStatus.role === "founder");
    const managerCount = members?.filter((m: any) => m.role === "manager" || m.role === "founder").length || 0;
    const managerMembers = members?.filter((m: any) => m.role === "manager" || m.role === "founder") || [];
    const regularMembers = members?.filter((m: any) => m.role === "member" && m.userId !== group?.createdBy) || [];
    const totalMemberCount = members?.length ?? 0;
    const isBootstrap = totalMemberCount <= 3;
    const governanceViolation = !isBootstrap && managerCount < 2;
    const governanceHealth: "Healthy" | "Warning" | "At Risk" =
        governanceViolation
            ? "At Risk"
            : (managerCount === 2 && totalMemberCount > 5 ? "Warning" : "Healthy");

    const pendingRequests = joinRequests?.filter((r: any) => r.status === "pending") || [];
    const votingRequests = joinRequests?.filter((r: any) => r.status === "voting") || [];

    // Helpers
    const getRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Handlers
    const handleRequest = async (requestId: Id<"joinRequests">, action: "approve" | "reject") => {
        setProcessingRequestId(requestId);
        try {
            await handleJoinRequest({ requestId, action });
            toast.success(action === "approve" ? "Member approved!" : "Request rejected.");
        } catch (e: any) {
            if (e.message.includes("GOVERNANCE_ERROR_PROMOTE_REQUIRED")) {
                toast.error("Action Blocked: Governance Rule", {
                    description: "Groups with >3 members must have at least 2 managers. Promote a member using the Manage Team panel.",
                    duration: 6000,
                });
            } else {
                toast.error(e.message || "Failed to process request");
            }
        } finally {
            setProcessingRequestId(null);
        }
    };

    if (!group || !members) return <div className="p-8 text-center text-muted-foreground animate-pulse font-mono uppercase">Loading governance data...</div>;

    if (!isManager) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 border border-dashed border-border bg-muted/20 rounded-lg">
                <Shield className="w-16 h-16 text-muted-foreground/20" />
                <h2 className="text-xl font-mono font-bold uppercase">Restricted Area</h2>
                <p className="text-muted-foreground text-xs font-mono uppercase">Managers only beyond this point</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Status Bar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between py-2">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold uppercase font-mono tracking-tighter">Civic Governance</h2>
                    <p className="text-muted-foreground text-[10px] font-mono uppercase">
                        Group Registry ID: {groupId.substring(0, 12)}...
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                        "h-7 gap-1.5 px-3 transition-colors font-mono text-[10px] uppercase",
                        governanceHealth === "Healthy" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                            governanceHealth === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                        {governanceHealth === "Healthy" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {(governanceHealth === "Warning" || governanceHealth === "At Risk") && <AlertTriangle className="w-3.5 h-3.5" />}
                        SYSTEM STATUS: {governanceHealth}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ─── LEFT COLUMN: Health & Team Management ─── */}
                <div className="space-y-6">
                    {/* Governance Health Score Panel */}
                    <Card className={cn(
                        "shadow-sm transition-colors border-border bg-card",
                        governanceHealth === "At Risk" && "border-red-500/30 bg-red-500/5"
                    )}>
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-mono">
                                <Activity className="w-3.5 h-3.5" /> // GOVERNANCE HEALTH SCORE
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {/* Status indicator */}
                            <div className={cn(
                                "flex items-center gap-2 p-2.5 rounded-sm border",
                                governanceHealthData?.status === "healthy"
                                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
                                    : governanceHealthData?.status === "low_participation"
                                        ? "bg-amber-500/5 border-amber-500/20 text-amber-500"
                                        : "bg-red-500/5 border-red-500/20 text-red-500"
                            )}>
                                <div className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    governanceHealthData?.status === "healthy"
                                        ? "bg-emerald-500"
                                        : governanceHealthData?.status === "low_participation"
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                )} />
                                <span className="text-[10px] font-mono font-bold uppercase">
                                    {governanceHealthData?.status === "healthy" ? "SYSTEM HEALTHY" :
                                        governanceHealthData?.status === "low_participation" ? "LOW PARTICIPATION" :
                                            "CENTRALIZATION RISK"}
                                </span>
                                {governanceHealthData?.isBootstrap && (
                                    <Badge variant="outline" className="ml-auto text-[8px] font-mono h-4 px-1.5">BOOTSTRAP</Badge>
                                )}
                            </div>

                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 gap-px bg-border border border-border overflow-hidden rounded-sm">
                                <div className="bg-card p-3">
                                    <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-bold font-mono">Managers</p>
                                    <p className="text-xl font-bold mt-1 text-foreground font-mono">{governanceHealthData?.managerCount ?? managerCount}</p>
                                </div>
                                <div className="bg-card p-3">
                                    <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-bold font-mono">Members</p>
                                    <p className="text-xl font-bold mt-1 text-foreground font-mono">{governanceHealthData?.memberCount ?? totalMemberCount}</p>
                                </div>
                                <div className="bg-card p-3">
                                    <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-bold font-mono">Vote Participation</p>
                                    <p className="text-xl font-bold mt-1 text-foreground font-mono">{governanceHealthData?.voteParticipationRate ?? 100}%</p>
                                </div>
                                <div className="bg-card p-3">
                                    <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-bold font-mono">Pending</p>
                                    <p className="text-xl font-bold mt-1 text-foreground font-mono">{governanceHealthData?.pendingDecisions ?? 0}</p>
                                </div>
                            </div>

                            {/* Rule compliance bar */}
                            {governanceHealthData && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Rule Compliance</p>
                                        <p className="text-[9px] font-mono font-bold">{governanceHealthData.ruleCompliance}%</p>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                governanceHealthData.ruleCompliance >= 80 ? "bg-emerald-500" :
                                                    governanceHealthData.ruleCompliance >= 50 ? "bg-amber-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${governanceHealthData.ruleCompliance}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {governanceViolation && (
                                <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-sm">
                                    <p className="font-bold flex items-center gap-2 text-[10px] font-mono uppercase">
                                        <AlertTriangle className="w-3.5 h-3.5" /> ACTION REQUIRED
                                    </p>
                                    <p className="mt-1 text-[10px] font-mono uppercase leading-relaxed opacity-80">
                                        Governance violation: Promote a member immediately to restore civic power.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Manager List & Promotions */}
                    <Card className="border-border bg-card">
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-mono">
                                <Users className="w-3.5 h-3.5" /> // TEAM
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-4">
                            <div className="space-y-3">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Management Board</p>
                                <div className="space-y-1.5">
                                    {managerMembers.map((m: any) => (
                                        <div key={m._id} className="flex items-center justify-between p-2 rounded-sm bg-muted/30 border border-border/50">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <ProfileAvatar userId={m.userId} name={m.name} avatarUrl={m.avatarUrl} className="w-7 h-7" />
                                                <div className="min-w-0">
                                                    <span className="text-xs font-bold truncate block leading-tight font-mono uppercase">{m.name}</span>
                                                    {(m.role === "founder" || m.userId === group.createdBy) && (
                                                        <span className="text-[9px] text-primary font-bold font-mono uppercase">FOUNDER</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Cannot propose against self or founder */}
                                            {m.userId !== me?._id && m.role !== "founder" && m.userId !== group.createdBy && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger className="h-6 w-6 p-0 hover:bg-muted flex items-center justify-center transition-colors">
                                                        <MoreVertical className="w-3 h-3 text-muted-foreground" />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="font-mono uppercase text-[10px]">
                                                        <DropdownMenuItem
                                                            className="text-red-500 focus:text-red-500"
                                                            onClick={() => setProposalTarget({ userId: m.userId, name: m.name, action: "demote" })}
                                                        >
                                                            Propose Demotion
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-purple-500 focus:text-purple-500"
                                                            onClick={async () => {
                                                                try {
                                                                    await triggerReconfirmation({ groupId, targetManagerId: m.userId });
                                                                    toast.success(`Reconfirmation vote started for ${m.name}`);
                                                                } catch (e: any) {
                                                                    toast.error(e.message || "Failed to trigger reconfirmation");
                                                                }
                                                            }}
                                                        >
                                                            <RefreshCw className="w-3 h-3 mr-1" /> Trigger Reconfirmation
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Regular Members */}
                            {regularMembers.length > 0 && (
                                <div className="space-y-3">
                                    <Separator />
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Members ({regularMembers.length})</p>
                                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                                        {regularMembers.map((m: any) => (
                                            <div key={m._id} className="flex items-center justify-between p-2 rounded-sm bg-muted/20 border border-border/30 hover:border-border/60 transition-colors">
                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                    <ProfileAvatar userId={m.userId} name={m.name} avatarUrl={m.avatarUrl} className="w-7 h-7" />
                                                    <span className="text-xs font-medium truncate block leading-tight font-mono uppercase">{m.name}</span>
                                                </div>
                                                {m.userId !== me?._id && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger className="h-6 w-6 p-0 hover:bg-muted flex items-center justify-center transition-colors rounded-sm">
                                                            <MoreVertical className="w-3 h-3 text-muted-foreground" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="font-mono uppercase text-[10px]">
                                                            <DropdownMenuItem
                                                                className="text-emerald-500 focus:text-emerald-500"
                                                                onClick={() => setProposalTarget({ userId: m.userId, name: m.name, action: "promote" })}
                                                            >
                                                                <ArrowUp className="w-3 h-3 mr-1.5" /> Propose Promotion
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-red-500 focus:text-red-500"
                                                                onClick={() => setProposalTarget({ userId: m.userId, name: m.name, action: "kick" })}
                                                            >
                                                                <UserX className="w-3 h-3 mr-1.5" /> Propose Removal
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </div>

                {/* ─── RIGHT COLUMN: Task Execution (Voting & Funds) ─── */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Active Join Requests & Voting */}
                    <Card className="border-primary/20 bg-primary/5 shadow-sm">
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-2 font-mono">
                                <Users className="w-3.5 h-3.5 text-primary" /> // JOIN REQUESTS
                                {(pendingRequests.length > 0 || votingRequests.length > 0) && (
                                    <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 text-[9px] font-mono">
                                        {pendingRequests.length + votingRequests.length}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {pendingRequests.length === 0 && votingRequests.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground bg-background rounded-sm border border-dashed border-border flex flex-col items-center">
                                    <CheckCircle2 className="w-8 h-8 opacity-20 mb-2" />
                                    <p className="text-[10px] font-mono uppercase tracking-widest">Registry Clear</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {[...pendingRequests, ...votingRequests].map((request: any) => (
                                        <div key={request._id} className="p-4 bg-background rounded-sm border border-border shadow-sm flex flex-col md:flex-row md:items-center gap-4 hover:border-primary/40 transition-colors">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <ProfileAvatar userId={request.userId} name={request.name} avatarUrl={request.avatarUrl} className="w-10 h-10" />
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm font-mono uppercase">{request.name}</span>
                                                        {request.status === "voting" && (
                                                            <Badge className="text-[8px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20 uppercase font-mono">VOTING ACTIVE</Badge>
                                                        )}
                                                    </div>
                                                    {request.message && (
                                                        <p className="text-[10px] text-muted-foreground font-mono uppercase italic border-l-2 pl-2 border-border line-clamp-2">
                                                            {request.message}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
                                                {isBootstrap ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-500/5 h-8 text-[10px] font-mono uppercase px-3"
                                                            onClick={() => handleRequest(request._id, "reject")}
                                                            disabled={processingRequestId === request._id}
                                                        >
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 text-[10px] font-mono uppercase px-3 shadow-lg shadow-primary/20"
                                                            onClick={() => handleRequest(request._id, "approve")}
                                                            disabled={processingRequestId === request._id}
                                                        >
                                                            Approve
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-[9px] text-right mr-3 font-mono uppercase">
                                                            <p className="font-black text-primary">{request.requiredVotes ? `${request.votes?.length || 0}/${request.requiredVotes}` : "-/-"}</p>
                                                            <p className="text-muted-foreground opacity-60">Votes</p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-[10px] font-mono uppercase border border-border/50"
                                                            onClick={() => castVote({ requestId: request._id, vote: "reject" })}
                                                            disabled={governanceViolation}
                                                        >
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 text-[10px] font-mono uppercase"
                                                            onClick={() => castVote({ requestId: request._id, vote: "approve" })}
                                                            disabled={governanceViolation}
                                                        >
                                                            Approve
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── ACTIVE PROPOSALS (Democratic Voting) ─── */}
                    <Card className={cn(
                        "shadow-sm border-border bg-card",
                        activeProposals && activeProposals.length > 0 && "border-amber-500/30 bg-amber-500/5"
                    )}>
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2 font-mono">
                                    <Gavel className="w-3.5 h-3.5" /> // ACTIVE PROPOSALS
                                    {activeProposals && activeProposals.length > 0 && (
                                        <Badge className="ml-2 bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-mono">
                                            {activeProposals.length}
                                        </Badge>
                                    )}
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[9px] font-mono uppercase gap-1 px-2"
                                    onClick={() => setShowPolicyDialog(true)}
                                >
                                    <Plus className="w-3 h-3" /> New Proposal
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4">
                            {(!activeProposals || activeProposals.length === 0) ? (
                                <div className="py-8 text-center text-muted-foreground bg-background rounded-sm border border-dashed border-border flex flex-col items-center">
                                    <Gavel className="w-8 h-8 opacity-10 mb-2" />
                                    <p className="text-[10px] font-mono uppercase tracking-widest">No Active Proposals</p>
                                    <p className="text-[9px] font-mono text-muted-foreground/60 mt-1">Create a policy proposal or propose actions from the team panel</p>
                                </div>
                            ) : (
                                activeProposals.map((proposal: any) => {
                                    const isApproved = proposal.myVote === "approve";
                                    const isRejected = proposal.myVote === "reject";
                                    const hasVoted = !!proposal.myVote;
                                    const isTarget = proposal.isTarget;
                                    const progressPercent = proposal.requiredVotes > 0 ? Math.round((proposal.approveCount / proposal.requiredVotes) * 100) : 0;
                                    const isPolicyProposal = proposal.proposalCategory === "policy";
                                    const timeRemaining = proposal.expiresAt ? Math.max(0, proposal.expiresAt - Date.now()) : 0;
                                    const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));

                                    const proposalConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
                                        demote: { icon: <ArrowDown className="w-4 h-4" />, color: "text-orange-500", bgColor: "bg-orange-500/10 border-orange-500/20", label: "Demote" },
                                        kick: { icon: <UserX className="w-4 h-4" />, color: "text-red-500", bgColor: "bg-red-500/10 border-red-500/20", label: "Remove" },
                                        promote: { icon: <ArrowUp className="w-4 h-4" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20", label: "Promote" },
                                        revert_promotion: { icon: <ArrowDown className="w-4 h-4" />, color: "text-orange-500", bgColor: "bg-orange-500/10 border-orange-500/20", label: "Revert Promotion" },
                                        revert_demotion: { icon: <ArrowUp className="w-4 h-4" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20", label: "Revert Demotion" },
                                        revert_removal: { icon: <LogIn className="w-4 h-4" />, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/20", label: "Reinstate" },
                                        approve_fund: { icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20", label: "Approve Fund" },
                                        change_visibility: { icon: <Eye className="w-4 h-4" />, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/20", label: "Change Visibility" },
                                        amend_description: { icon: <FileText className="w-4 h-4" />, color: "text-purple-500", bgColor: "bg-purple-500/10 border-purple-500/20", label: "Amend Description" },
                                        custom: { icon: <ScrollText className="w-4 h-4" />, color: "text-indigo-500", bgColor: "bg-indigo-500/10 border-indigo-500/20", label: "Custom Proposal" },
                                    };
                                    const pConfig = proposalConfig[proposal.actionType] || { icon: <Gavel className="w-4 h-4" />, color: "text-muted-foreground", bgColor: "bg-muted/10 border-border", label: proposal.actionType };

                                    return (
                                        <div key={proposal._id} className="p-4 bg-background rounded-sm border border-border shadow-sm space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={cn("shrink-0 w-8 h-8 rounded-sm border flex items-center justify-center", pConfig.bgColor, pConfig.color)}>
                                                        {pConfig.icon}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold font-mono uppercase truncate">
                                                            {isPolicyProposal ? (proposal.proposalTitle || pConfig.label) : `${pConfig.label} ${proposal.targetName}`}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground font-mono uppercase">
                                                            {isPolicyProposal && <Badge variant="outline" className="text-[7px] font-mono h-3.5 px-1 mr-1.5">POLICY</Badge>}
                                                            Proposed by {proposal.proposerName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {hoursRemaining > 0 && (
                                                        <span className="text-[8px] font-mono text-muted-foreground">{hoursRemaining}h left</span>
                                                    )}
                                                    <Badge variant="outline" className="shrink-0 text-[8px] font-mono uppercase bg-amber-500/10 text-amber-500 border-amber-500/20">
                                                        <Clock className="w-2.5 h-2.5 mr-1" /> Pending
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Description for policy proposals */}
                                            {isPolicyProposal && proposal.proposalDescription && (
                                                <p className="text-[10px] text-muted-foreground font-mono leading-relaxed border-l-2 border-indigo-500/30 pl-2.5">
                                                    {proposal.proposalDescription}
                                                </p>
                                            )}

                                            {proposal.reason && !isPolicyProposal && (
                                                <p className="text-[10px] text-muted-foreground font-mono uppercase italic border-l-2 border-amber-500/30 pl-2.5 leading-relaxed">
                                                    &quot;{proposal.reason}&quot;
                                                </p>
                                            )}

                                            {/* Vote progress */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[9px] font-mono uppercase font-bold">
                                                    <span className="text-emerald-500">{proposal.approveCount} approve</span>
                                                    <span className="text-muted-foreground">{proposal.rejectCount} reject</span>
                                                    <span className="text-foreground">{proposal.approveCount + proposal.rejectCount}/{proposal.requiredVotes} needed</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                                                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${proposal.requiredVotes > 0 ? Math.round((proposal.rejectCount / proposal.requiredVotes) * 100) : 0}%` }} />
                                                </div>
                                            </div>

                                            {/* Voting buttons */}
                                            <div className="flex items-center gap-2 pt-1">
                                                {isTarget ? (
                                                    <p className="text-[9px] font-mono uppercase text-muted-foreground/60 flex items-center gap-1.5 italic">
                                                        <Shield className="w-3 h-3" />
                                                        You are the subject of this proposal
                                                    </p>
                                                ) : hasVoted ? (
                                                    <p className="text-[9px] font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                                                        <Check className="w-3 h-3" />
                                                        You voted: <span className={cn("font-bold", isApproved ? "text-emerald-500" : "text-red-500")}>{proposal.myVote}</span>
                                                    </p>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[9px] font-mono uppercase text-red-500 hover:text-red-600 hover:bg-red-500/5 border-red-500/20"
                                                            onClick={async () => {
                                                                try {
                                                                    await voteOnProposal({ proposalId: proposal._id, vote: "reject" });
                                                                    toast.success("Vote cast: Reject");
                                                                } catch (e: any) {
                                                                    toast.error(e.message || "Failed to cast vote");
                                                                }
                                                            }}
                                                        >
                                                            <X className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-[9px] font-mono uppercase shadow-lg shadow-emerald-500/10"
                                                            onClick={async () => {
                                                                try {
                                                                    await voteOnProposal({ proposalId: proposal._id, vote: "approve" });
                                                                    toast.success("Vote cast: Approve");
                                                                } catch (e: any) {
                                                                    toast.error(e.message || "Failed to cast vote");
                                                                }
                                                            }}
                                                        >
                                                            <Check className="w-3 h-3 mr-1" /> Approve
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── MANAGER RECONFIRMATION (Soft Term Limits) ─── */}
                    <Card className="border-border bg-card shadow-sm">
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-mono">
                                <RefreshCw className="w-3.5 h-3.5" /> // MANAGER RECONFIRMATION
                                {activeReconfirmations && activeReconfirmations.length > 0 && (
                                    <Badge className="ml-2 bg-purple-500/10 text-purple-500 border-purple-500/20 text-[9px] font-mono">
                                        {activeReconfirmations.length} active
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4">
                            <p className="text-[9px] font-mono text-muted-foreground uppercase leading-relaxed">
                                Any manager can trigger a reconfirmation vote for another manager. All group members vote. Majority decides.
                            </p>

                            {activeReconfirmations && activeReconfirmations.length > 0 ? (
                                <div className="space-y-3">
                                    {activeReconfirmations.map((r: any) => {
                                        const confirmPercent = r.requiredVotes > 0 ? Math.round((r.confirmCount / r.requiredVotes) * 100) : 0;
                                        return (
                                            <div key={r._id} className="p-4 bg-background rounded-sm border border-purple-500/20 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="shrink-0 w-8 h-8 rounded-sm border bg-purple-500/10 border-purple-500/20 text-purple-500 flex items-center justify-center">
                                                            <RefreshCw className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold font-mono uppercase truncate">
                                                                Reconfirm {r.targetName}
                                                            </p>
                                                            <p className="text-[9px] text-muted-foreground font-mono uppercase">
                                                                Triggered by {r.triggeredByName} • {getRelativeTime(r.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0 text-[8px] font-mono uppercase bg-purple-500/10 text-purple-500 border-purple-500/20">
                                                        Voting
                                                    </Badge>
                                                </div>

                                                {/* Vote progress */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[9px] font-mono uppercase font-bold">
                                                        <span className="text-emerald-500">{r.confirmCount} confirm</span>
                                                        <span className="text-red-500">{r.removeCount} remove</span>
                                                        <span className="text-foreground">{r.totalVotes}/{r.requiredVotes} needed</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                                                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${confirmPercent}%` }} />
                                                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${r.requiredVotes > 0 ? Math.round((r.removeCount / r.requiredVotes) * 100) : 0}%` }} />
                                                    </div>
                                                </div>

                                                {/* Voting buttons */}
                                                <div className="flex items-center gap-2 pt-1">
                                                    {r.isTarget ? (
                                                        <p className="text-[9px] font-mono uppercase text-muted-foreground/60 flex items-center gap-1.5 italic">
                                                            <Shield className="w-3 h-3" />
                                                            This reconfirmation is about your role
                                                        </p>
                                                    ) : r.myVote ? (
                                                        <p className="text-[9px] font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                                                            <Check className="w-3 h-3" />
                                                            You voted: <span className={cn("font-bold", r.myVote === "confirm" ? "text-emerald-500" : "text-red-500")}>{r.myVote}</span>
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[9px] font-mono uppercase text-red-500 hover:text-red-600 hover:bg-red-500/5 border-red-500/20"
                                                                onClick={async () => {
                                                                    try {
                                                                        await voteOnReconfirmation({ reconfirmationId: r._id, vote: "remove" });
                                                                        toast.success("Vote cast: Remove");
                                                                    } catch (e: any) {
                                                                        toast.error(e.message || "Failed to cast vote");
                                                                    }
                                                                }}
                                                            >
                                                                <X className="w-3 h-3 mr-1" /> Remove
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="h-7 text-[9px] font-mono uppercase shadow-lg shadow-purple-500/10"
                                                                onClick={async () => {
                                                                    try {
                                                                        await voteOnReconfirmation({ reconfirmationId: r._id, vote: "confirm" });
                                                                        toast.success("Vote cast: Confirm");
                                                                    } catch (e: any) {
                                                                        toast.error(e.message || "Failed to cast vote");
                                                                    }
                                                                }}
                                                            >
                                                                <Check className="w-3 h-3 mr-1" /> Confirm
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-6 text-center text-muted-foreground bg-background rounded-sm border border-dashed border-border flex flex-col items-center">
                                    <RefreshCw className="w-6 h-6 opacity-10 mb-2" />
                                    <p className="text-[10px] font-mono uppercase tracking-widest">No Active Reconfirmations</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── RESOLVED PROPOSALS HISTORY ─── */}
                    {resolvedProposals && resolvedProposals.length > 0 && (
                        <Card className="border-border bg-card shadow-sm">
                            <CardHeader
                                className="pb-3 px-4 py-3 bg-muted/40 border-b border-border cursor-pointer"
                                onClick={() => setShowResolvedProposals(!showResolvedProposals)}
                            >
                                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-mono">
                                    <History className="w-3.5 h-3.5" /> // PROPOSAL HISTORY
                                    <Badge variant="outline" className="ml-2 text-[8px] font-mono">{resolvedProposals.length}</Badge>
                                    <span className="ml-auto">
                                        {showResolvedProposals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            {showResolvedProposals && (
                                <CardContent className="space-y-2 pt-4">
                                    {resolvedProposals.map((p: any) => {
                                        const statusConfig: Record<string, { color: string; label: string }> = {
                                            approved: { color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", label: "Approved" },
                                            rejected: { color: "text-red-500 bg-red-500/10 border-red-500/20", label: "Rejected" },
                                            expired: { color: "text-muted-foreground bg-muted/10 border-border", label: "Expired" },
                                        };
                                        const sConfig = statusConfig[p.status] || statusConfig.expired;
                                        return (
                                            <div key={p._id} className="flex items-center justify-between py-2 px-2 rounded-sm hover:bg-muted/30 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-mono uppercase font-bold truncate">
                                                        {p.proposalCategory === "policy"
                                                            ? (p.proposalTitle || p.actionType)
                                                            : `${p.actionType} ${p.targetName}`}
                                                    </p>
                                                    <p className="text-[9px] text-muted-foreground font-mono uppercase">
                                                        By {p.proposerName} • {p.resolvedAt ? getRelativeTime(p.resolvedAt) : getRelativeTime(p.createdAt)}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className={cn("text-[8px] font-mono uppercase h-5 px-1.5", sConfig.color)}>
                                                    {sConfig.label}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* ─── AUTOMOD (Timeouts & Warnings) ─── */}
                    <Card className="border-red-500/20 bg-red-500/5 shadow-sm">
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-2 font-mono">
                                <ShieldAlert className="w-3.5 h-3.5" /> // AUTOMOD
                                {autoModStatus && autoModStatus.users.filter(u => u.isTimedOut).length > 0 && (
                                    <Badge className="ml-2 bg-red-500/10 text-red-500 border-red-500/20 text-[9px] font-mono">
                                        {autoModStatus.users.filter(u => u.isTimedOut).length} TIMED OUT
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {!autoModStatus || autoModStatus.users.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground bg-background rounded-sm border border-dashed border-border flex flex-col items-center">
                                    <CheckCircle2 className="w-8 h-8 opacity-20 mb-2" />
                                    <p className="text-[10px] font-mono uppercase tracking-widest">All Clear</p>
                                    <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">No AutoMod violations recorded</p>
                                </div>
                            ) : (
                                <>
                                    {/* User list with warnings & timeouts */}
                                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                        {autoModStatus.users.map((u) => {
                                            const remainingMs = u.timeoutUntil ? u.timeoutUntil - Date.now() : 0;
                                            const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));

                                            return (
                                                <div
                                                    key={u.userId}
                                                    className={cn(
                                                        "p-3 rounded-sm border space-y-2 transition-colors",
                                                        u.isTimedOut
                                                            ? "border-red-500/30 bg-red-500/10"
                                                            : "border-amber-500/20 bg-amber-500/5"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <ProfileAvatar userId={u.userId} name={u.userName} avatarUrl={u.avatarUrl} className="w-8 h-8" />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold font-mono uppercase truncate">
                                                                    {u.userName}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] font-mono text-amber-500 font-bold">
                                                                        {u.totalWarnings} warning{u.totalWarnings !== 1 ? "s" : ""}
                                                                    </span>
                                                                    {u.recentWarnings > 0 && (
                                                                        <span className="text-[8px] font-mono text-muted-foreground">
                                                                            ({u.recentWarnings} in 24h)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {u.lastCategory && (
                                                                <Badge variant="outline" className="text-[8px] uppercase font-mono h-4 px-1.5">
                                                                    {u.lastCategory}
                                                                </Badge>
                                                            )}
                                                            {u.isTimedOut ? (
                                                                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[8px] uppercase font-mono h-4 px-1.5 gap-1">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    {remainingMin}m left
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[8px] uppercase font-mono h-4 px-1.5 text-muted-foreground">
                                                                    Active
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Lift timeout action for managers */}
                                                    {u.isTimedOut && u.timeoutId && (
                                                        <div className="flex items-center justify-between pt-1 border-t border-border/30">
                                                            <span className="text-[9px] font-mono text-red-400 uppercase">
                                                                Muted until {new Date(u.timeoutUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-[9px] font-mono uppercase gap-1 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                                                disabled={liftingTimeoutId === u.timeoutId}
                                                                onClick={async () => {
                                                                    setLiftingTimeoutId(u.timeoutId!);
                                                                    try {
                                                                        await liftTimeout({ timeoutId: u.timeoutId as Id<"userTimeouts"> });
                                                                        toast.success(`Timeout lifted for ${u.userName}`);
                                                                    } catch (e: any) {
                                                                        toast.error(e.message || "Failed to lift timeout");
                                                                    } finally {
                                                                        setLiftingTimeoutId(null);
                                                                    }
                                                                }}
                                                            >
                                                                {liftingTimeoutId === u.timeoutId
                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                    : <Check className="w-3 h-3" />}
                                                                Lift Timeout
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Recent warning log */}
                                    {autoModStatus.recentWarningLog.length > 0 && (
                                        <div className="space-y-2">
                                            <Separator />
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Recent Warnings</p>
                                            <div className="space-y-0 max-h-[250px] overflow-y-auto pr-1">
                                                {autoModStatus.recentWarningLog.map((w, i) => {
                                                    const warningEmoji = w.warningNumber >= 4 ? "\uD83D\uDD34" : w.warningNumber >= 3 ? "\uD83D\uDFE0" : w.warningNumber >= 2 ? "\uD83D\uDFE1" : "\u26A0\uFE0F";
                                                    const timeAgo = getRelativeTime(w.createdAt);

                                                    return (
                                                        <div key={w._id} className="flex gap-3 py-2 group">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm leading-none">{warningEmoji}</span>
                                                                {i < autoModStatus.recentWarningLog.length - 1 && (
                                                                    <div className="w-px flex-1 bg-border/50 mt-1" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-mono uppercase leading-tight">
                                                                    <span className="font-bold">{w.userName}</span>
                                                                    <span className="text-muted-foreground"> — {w.reason}</span>
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] text-muted-foreground/60 font-mono">Warning #{w.warningNumber}</span>
                                                                    {w.timeoutApplied && (
                                                                        <span className="text-[8px] text-red-400 font-mono uppercase">
                                                                            +{Math.round(w.timeoutApplied / 60000)}m timeout
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] text-muted-foreground/40 font-mono">{timeAgo}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Community Fund Section */}
                    <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-2 font-mono">
                                    <TrendingUp className="w-3.5 h-3.5" /> // COMMUNITY FUND
                                </CardTitle>
                                <CardDescription className="text-[9px] uppercase font-mono text-muted-foreground mt-0.5">Crowdfunding via Razorpay</CardDescription>
                            </div>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] uppercase font-mono border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" onClick={() => setShowCreateFundDialog(true)}>
                                <Plus className="w-3 h-3 mr-1" /> New Goal
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {funds && funds.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {funds.filter(f => f.isActive).map((fund) => {
                                        const progress = Math.min(100, (fund.currentAmount / fund.targetAmount) * 100);
                                        return (
                                            <div key={fund._id} className="p-4 bg-background rounded-sm border border-border shadow-sm space-y-4 relative overflow-hidden group">
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-black uppercase tracking-tight font-mono">{fund.title}</h4>
                                                    <p className="text-[9px] text-muted-foreground uppercase font-mono line-clamp-2 leading-relaxed">{fund.description}</p>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-mono font-bold uppercase">
                                                        <span className="text-emerald-500">₹{fund.currentAmount.toLocaleString()}</span>
                                                        <span className="text-muted-foreground">₹{fund.targetAmount.toLocaleString()}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 transition-all duration-700"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    className="w-full h-8 text-[10px] font-mono uppercase bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/10"
                                                    onClick={async () => {
                                                        try {
                                                            const amount = 500;
                                                            // 1. Create Order
                                                            const order = await createOrder({
                                                                amount: amount,
                                                                currency: "INR",
                                                                receipt: `fund_${fund._id}`,
                                                                notes: { fundId: fund._id, userId: me?._id }
                                                            });

                                                            // 2. Open Razorpay using inline loader
                                                            const loadRazorpay = async () => {
                                                                return new Promise((resolve) => {
                                                                    const script = document.createElement("script");
                                                                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                                                                    script.onload = () => resolve(true);
                                                                    script.onerror = () => resolve(false);
                                                                    document.body.appendChild(script);
                                                                });
                                                            };

                                                            await loadRazorpay();

                                                            const options = {
                                                                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                                                                amount: order.amount,
                                                                currency: order.currency,
                                                                name: "CityHub",
                                                                description: `Contribution to ${fund.title}`,
                                                                order_id: order.id,
                                                                handler: async (response: any) => {
                                                                    try {
                                                                        // 3. Verify Payment
                                                                        await verifyPayment({
                                                                            razorpay_order_id: response.razorpay_order_id,
                                                                            razorpay_payment_id: response.razorpay_payment_id,
                                                                            razorpay_signature: response.razorpay_signature,
                                                                            type: "fund",
                                                                            targetId: fund._id,
                                                                            amount: amount,
                                                                            userId: me?._id || ""
                                                                        });
                                                                        toast.success("Contribution successful!");
                                                                    } catch (e: any) {
                                                                        console.error(e);
                                                                        toast.error(e.message || "Payment verification failed");
                                                                    }
                                                                },
                                                                prefill: {
                                                                    name: me?.name || "",
                                                                    email: "",
                                                                },
                                                                theme: { color: "#10b981" }
                                                            };

                                                            const rzp = new (window as any).Razorpay(options);
                                                            rzp.open();

                                                        } catch (e: any) {
                                                            toast.error(e.message || "Failed to initiate payment");
                                                        }
                                                    }}
                                                >
                                                    Contribute ₹500
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-muted-foreground bg-background rounded-sm border border-dashed border-border flex flex-col items-center">
                                    <TrendingUp className="w-8 h-8 opacity-10 mb-2" />
                                    <p className="text-[10px] font-mono uppercase tracking-widest">No Active Goals</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Audit Log */}
                    <Card className="border-border bg-card">
                        <CardHeader className="pb-3 px-4 py-3 bg-muted/40 border-b border-border">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-mono">
                                <History className="w-3.5 h-3.5" /> // AUDIT LOG
                                {governanceLogs && governanceLogs.length > 0 && (
                                    <Badge variant="outline" className="ml-2 text-[8px] font-mono">{governanceLogs.length}</Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            {/* Filter pills */}
                            {governanceLogs && governanceLogs.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {[
                                        { key: "all", label: "All" },
                                        { key: "roles", label: "Roles" },
                                        { key: "members", label: "Members" },
                                        { key: "proposals", label: "Proposals" },
                                        { key: "moderation", label: "Moderation" },
                                    ].map((f) => (
                                        <button
                                            key={f.key}
                                            className={cn(
                                                "px-2 py-0.5 text-[9px] font-mono uppercase rounded-full border transition-colors",
                                                logFilter === f.key
                                                    ? "bg-primary/10 text-primary border-primary/30"
                                                    : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
                                            )}
                                            onClick={() => setLogFilter(f.key)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!governanceLogs || governanceLogs.length === 0 ? (
                                <div className="text-[10px] font-mono uppercase text-muted-foreground text-center py-10 border border-dashed border-border/50 rounded-sm flex flex-col items-center gap-2">
                                    <History className="w-6 h-6 opacity-15" />
                                    No governance actions recorded yet
                                </div>
                            ) : (
                                <div className="space-y-0 max-h-[400px] overflow-y-auto pr-1">
                                    {governanceLogs
                                        .filter((log: any) => {
                                            if (logFilter === "all") return true;
                                            if (logFilter === "roles") return ["promotion", "demotion", "transfer_founder"].includes(log.actionType);
                                            if (logFilter === "members") return ["join", "leave", "removal"].includes(log.actionType);
                                            if (logFilter === "proposals") return ["vote_resolution_approved", "vote_resolution_rejected", "proposal_expired", "proposal_created"].includes(log.actionType);
                                            if (logFilter === "moderation") return ["automod_block", "timeout_lifted", "moderation_warning"].includes(log.actionType);
                                            return true;
                                        })
                                        .slice(0, 30).map((log: any, i: number, arr: any[]) => {
                                            const actionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                                                promotion: { icon: <ArrowUp className="w-3 h-3" />, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", label: "Promoted" },
                                                demotion: { icon: <ArrowDown className="w-3 h-3" />, color: "text-orange-500 bg-orange-500/10 border-orange-500/20", label: "Demoted" },
                                                removal: { icon: <UserX className="w-3 h-3" />, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "Removed" },
                                                transfer_founder: { icon: <Shield className="w-3 h-3" />, color: "text-purple-500 bg-purple-500/10 border-purple-500/20", label: "Transferred Founder" },
                                                vote_resolution_approved: { icon: <Check className="w-3 h-3" />, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", label: "Approved" },
                                                vote_resolution_rejected: { icon: <X className="w-3 h-3" />, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "Rejected" },
                                                proposal_expired: { icon: <Clock className="w-3 h-3" />, color: "text-muted-foreground bg-muted/10 border-border", label: "Proposal Expired" },
                                                proposal_created: { icon: <Gavel className="w-3 h-3" />, color: "text-amber-500 bg-amber-500/10 border-amber-500/20", label: "Proposal Created" },
                                                join: { icon: <LogIn className="w-3 h-3" />, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", label: "Joined" },
                                                leave: { icon: <LogOut className="w-3 h-3" />, color: "text-gray-500 bg-gray-500/10 border-gray-500/20", label: "Left" },
                                                create_fund: { icon: <TrendingUp className="w-3 h-3" />, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", label: "Fund Created" },
                                                settings: { icon: <Settings className="w-3 h-3" />, color: "text-purple-500 bg-purple-500/10 border-purple-500/20", label: "Settings" },
                                                automod_block: { icon: <ShieldAlert className="w-3 h-3" />, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "AutoMod Block" },
                                                timeout_lifted: { icon: <Check className="w-3 h-3" />, color: "text-green-500 bg-green-500/10 border-green-500/20", label: "Timeout Lifted" },
                                                moderation_warning: { icon: <AlertTriangle className="w-3 h-3" />, color: "text-amber-500 bg-amber-500/10 border-amber-500/20", label: "Moderation Warning" },
                                            };
                                            const config = actionConfig[log.actionType] || { icon: <History className="w-3 h-3" />, color: "text-muted-foreground bg-muted/50 border-border", label: log.actionType || "Action" };
                                            const timeAgo = getRelativeTime(log.createdAt);

                                            return (
                                                <div
                                                    key={log._id}
                                                    className="flex gap-3 py-2.5 group cursor-pointer hover:bg-muted/30 rounded-sm px-1 -mx-1 transition-colors"
                                                    onClick={() => setSelectedLog({ ...log, config, timeAgo })}
                                                >
                                                    {/* Timeline line */}
                                                    <div className="flex flex-col items-center">
                                                        <div className={cn("w-6 h-6 rounded-sm border flex items-center justify-center shrink-0", config.color)}>
                                                            {config.icon}
                                                        </div>
                                                        {i < arr.length - 1 && (
                                                            <div className="w-px flex-1 bg-border/50 mt-1" />
                                                        )}
                                                    </div>
                                                    {/* Content */}
                                                    <div className="min-w-0 flex-1 pb-1">
                                                        <p className="text-[10px] font-mono uppercase leading-tight">
                                                            <span className="font-bold">{log.actorName || "System"}</span>
                                                            <span className="text-muted-foreground"> {(config.label || "action").toLowerCase()} </span>
                                                            {log.targetName && <span className="font-bold">{log.targetName}</span>}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground/60 font-mono uppercase mt-0.5">{timeAgo}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
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
                                        <div className={cn("w-10 h-10 rounded-sm border flex items-center justify-center shrink-0", selectedLog.config.color)}>
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
                                                <Badge variant="outline" className={cn("text-[8px] uppercase font-mono h-4 px-1.5", selectedLog.config.color)}>
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

                                    {/* Details */}
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
                                            {(selectedLog.config.label || "performed an action").toLowerCase()}{" "}
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

            {/* CREATE FUND DIALOG */}
            <Dialog open={showCreateFundDialog} onOpenChange={setShowCreateFundDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-tighter">Open Community Fund</DialogTitle>
                        <DialogDescription className="font-mono text-[10px] uppercase text-muted-foreground">Crowdfunding for civic projects</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Goal Title</label>
                            <Input placeholder="e.g. Neighborhood Garden Toolset" value={fundForm.title} onChange={(e) => setFundForm({ ...fundForm, title: e.target.value })} className="font-mono text-sm" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Description</label>
                            <Textarea placeholder="How will these funds be utilized?" value={fundForm.description} onChange={(e) => setFundForm({ ...fundForm, description: e.target.value })} className="font-mono text-sm min-h-20" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Target Amount (INR)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₹</span>
                                <Input type="number" placeholder="5000" value={fundForm.targetAmount || ""} onChange={(e) => setFundForm({ ...fundForm, targetAmount: Number(e.target.value) })} className="pl-7 font-mono text-sm" />
                            </div>
                        </div>
                        <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-sm">
                            <p className="text-[9px] font-mono text-indigo-400 uppercase leading-relaxed">
                                <Shield className="w-3 h-3 inline mr-1" /> All contributions are processed via Razorpay and logged in the civic ledger.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="font-mono text-[10px] uppercase" onClick={() => setShowCreateFundDialog(false)}>Cancel</Button>
                        <Button
                            className="font-mono text-[10px] uppercase gap-2"
                            disabled={isCreatingFund || !fundForm.title || !fundForm.targetAmount}
                            onClick={async () => {
                                setIsCreatingFund(true);
                                try {
                                    await createFund({
                                        groupId,
                                        title: fundForm.title,
                                        description: fundForm.description,
                                        targetAmount: fundForm.targetAmount
                                    });
                                    toast.success("Community fund active!");
                                    setShowCreateFundDialog(false);
                                } catch (e: any) {
                                    toast.error(e.message || "Failed to create fund");
                                } finally {
                                    setIsCreatingFund(false);
                                }
                            }}
                        >
                            {isCreatingFund ? "Opening..." : "Publicize Goal"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PROPOSAL CREATION DIALOG */}
            <Dialog open={!!proposalTarget} onOpenChange={(open) => { if (!open) { setProposalTarget(null); setProposalReason(""); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-tighter flex items-center gap-2">
                            <Gavel className="w-4 h-4" />
                            {proposalTarget?.action === "promote" ? "Propose Promotion" :
                                proposalTarget?.action === "demote" ? "Propose Demotion" :
                                    proposalTarget?.action === "kick" ? "Propose Removal" :
                                        proposalTarget?.action === "revert_promotion" ? "Propose Revert (Promotion)" :
                                            proposalTarget?.action === "revert_demotion" ? "Propose Revert (Demotion)" :
                                                proposalTarget?.action === "revert_removal" ? "Propose Reinstatement" : "Propose Action"}
                        </DialogTitle>
                        <DialogDescription className="font-mono text-[10px] uppercase text-muted-foreground">
                            This action requires 50% or more manager votes to pass
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted/50 border border-border rounded-sm flex items-center gap-3">
                            {(() => {
                                const iconMap: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
                                    promote: { icon: <ArrowUp className="w-4 h-4" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
                                    demote: { icon: <ArrowDown className="w-4 h-4" />, color: "text-orange-500", bgColor: "bg-orange-500/10 border-orange-500/20" },
                                    kick: { icon: <UserX className="w-4 h-4" />, color: "text-red-500", bgColor: "bg-red-500/10 border-red-500/20" },
                                    revert_promotion: { icon: <ArrowDown className="w-4 h-4" />, color: "text-orange-500", bgColor: "bg-orange-500/10 border-orange-500/20" },
                                    revert_demotion: { icon: <ArrowUp className="w-4 h-4" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
                                    revert_removal: { icon: <LogIn className="w-4 h-4" />, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/20" },
                                };
                                const ic = iconMap[proposalTarget?.action || ""] || { icon: <Gavel className="w-4 h-4" />, color: "text-muted-foreground", bgColor: "bg-muted/10 border-border" };
                                return (
                                    <div className={cn("w-8 h-8 rounded-sm border flex items-center justify-center shrink-0", ic.bgColor, ic.color)}>
                                        {ic.icon}
                                    </div>
                                );
                            })()}
                            <div>
                                <p className="text-xs font-bold font-mono uppercase">
                                    {proposalTarget?.action === "promote" ? "Promote" :
                                        proposalTarget?.action === "demote" ? "Demote" :
                                            proposalTarget?.action === "kick" ? "Remove" :
                                                proposalTarget?.action === "revert_promotion" ? "Revert Promotion of" :
                                                    proposalTarget?.action === "revert_demotion" ? "Revert Demotion of" :
                                                        proposalTarget?.action === "revert_removal" ? "Reinstate" : "Act on"} {proposalTarget?.name}
                                </p>
                                <p className="text-[9px] text-muted-foreground font-mono uppercase">
                                    {proposalTarget?.action === "promote" ? "From regular member to manager" :
                                        proposalTarget?.action === "demote" ? "From manager to regular member" :
                                            proposalTarget?.action === "kick" ? "Remove from group entirely" :
                                                proposalTarget?.action === "revert_promotion" ? "Undo promotion back to member" :
                                                    proposalTarget?.action === "revert_demotion" ? "Undo demotion back to manager" :
                                                        proposalTarget?.action === "revert_removal" ? "Re-add removed member to group" : "Governance action"}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Reason (optional)</label>
                            <Textarea
                                placeholder="Explain why this action is necessary..."
                                value={proposalReason}
                                onChange={(e) => setProposalReason(e.target.value)}
                                className="font-mono text-sm min-h-20"
                            />
                        </div>
                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-sm">
                            <p className="text-[9px] font-mono text-amber-500 uppercase leading-relaxed">
                                <Gavel className="w-3 h-3 inline mr-1" /> 50% or more manager votes will auto-accept. Your vote is auto-cast as &quot;approve&quot;.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="font-mono text-[10px] uppercase" onClick={() => { setProposalTarget(null); setProposalReason(""); }}>Cancel</Button>
                        <Button
                            variant={proposalTarget?.action === "promote" || proposalTarget?.action === "revert_demotion" || proposalTarget?.action === "revert_removal" ? "default" : "destructive"}
                            className="font-mono text-[10px] uppercase gap-2"
                            onClick={async () => {
                                if (!proposalTarget) return;
                                try {
                                    await proposeAction({
                                        groupId,
                                        targetUserId: proposalTarget.userId as Id<"users">,
                                        actionType: proposalTarget.action,
                                        reason: proposalReason || undefined,
                                    });
                                    toast.success(`Proposal created! Managers will now vote on this action.`);
                                    setProposalTarget(null);
                                    setProposalReason("");
                                } catch (e: any) {
                                    toast.error(e.message || "Failed to create proposal");
                                }
                            }}
                        >
                            <Gavel className="w-3 h-3" /> Submit Proposal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* POLICY PROPOSAL CREATION DIALOG */}
            <Dialog open={showPolicyDialog} onOpenChange={(open) => { if (!open) { setShowPolicyDialog(false); setPolicyForm({ actionType: "custom", title: "", description: "", payload: {} }); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-tighter flex items-center gap-2">
                            <ScrollText className="w-4 h-4" />
                            New Policy Proposal
                        </DialogTitle>
                        <DialogDescription className="font-mono text-[10px] uppercase text-muted-foreground">
                            Create a proposal for the entire group to vote on. 72h voting window.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Proposal type selector */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Proposal Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { type: "custom" as const, label: "Custom", icon: <ScrollText className="w-3.5 h-3.5" />, color: "text-indigo-500 border-indigo-500/30 bg-indigo-500/5" },
                                    { type: "amend_description" as const, label: "Amend Description", icon: <FileText className="w-3.5 h-3.5" />, color: "text-purple-500 border-purple-500/30 bg-purple-500/5" },
                                    { type: "change_visibility" as const, label: "Change Visibility", icon: <Eye className="w-3.5 h-3.5" />, color: "text-blue-500 border-blue-500/30 bg-blue-500/5" },
                                    { type: "approve_fund" as const, label: "Approve Fund", icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" },
                                ].map(({ type, label, icon, color }) => (
                                    <button
                                        key={type}
                                        className={cn(
                                            "flex items-center gap-2 p-2.5 rounded-sm border text-[10px] font-mono uppercase transition-all",
                                            policyForm.actionType === type ? color + " font-bold" : "border-border hover:border-primary/30 text-muted-foreground"
                                        )}
                                        onClick={() => setPolicyForm({ ...policyForm, actionType: type, payload: {} })}
                                    >
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Title</label>
                            <Input
                                placeholder={policyForm.actionType === "amend_description" ? "e.g. Update our group description" : policyForm.actionType === "change_visibility" ? "e.g. Make group public" : policyForm.actionType === "approve_fund" ? "e.g. Approve community event fund" : "e.g. Weekly cleanup drive policy"}
                                value={policyForm.title}
                                onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })}
                                className="font-mono text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Description</label>
                            <Textarea
                                placeholder="Explain the proposal and its rationale..."
                                value={policyForm.description}
                                onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                                className="font-mono text-sm min-h-20"
                            />
                        </div>

                        {/* Conditional payload fields */}
                        {policyForm.actionType === "amend_description" && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">New Description</label>
                                <Textarea
                                    placeholder="Enter the proposed new description..."
                                    value={policyForm.payload.newDescription || ""}
                                    onChange={(e) => setPolicyForm({ ...policyForm, payload: { ...policyForm.payload, newDescription: e.target.value } })}
                                    className="font-mono text-sm min-h-16"
                                />
                            </div>
                        )}

                        {policyForm.actionType === "change_visibility" && (
                            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-sm">
                                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Set group to</span>
                                <div className="flex gap-2">
                                    <button
                                        className={cn("px-3 py-1 rounded-sm text-[10px] font-mono uppercase border transition-all", policyForm.payload.isPublic === true ? "bg-blue-500/10 text-blue-500 border-blue-500/30 font-bold" : "border-border text-muted-foreground")}
                                        onClick={() => setPolicyForm({ ...policyForm, payload: { isPublic: true } })}
                                    >
                                        <Eye className="w-3 h-3 inline mr-1" /> Public
                                    </button>
                                    <button
                                        className={cn("px-3 py-1 rounded-sm text-[10px] font-mono uppercase border transition-all", policyForm.payload.isPublic === false ? "bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold" : "border-border text-muted-foreground")}
                                        onClick={() => setPolicyForm({ ...policyForm, payload: { isPublic: false } })}
                                    >
                                        <EyeOff className="w-3 h-3 inline mr-1" /> Private
                                    </button>
                                </div>
                            </div>
                        )}

                        {policyForm.actionType === "approve_fund" && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Fund Title</label>
                                    <Input
                                        placeholder="e.g. Community Garden Supplies"
                                        value={policyForm.payload.title || ""}
                                        onChange={(e) => setPolicyForm({ ...policyForm, payload: { ...policyForm.payload, title: e.target.value } })}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Target Amount (INR)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₹</span>
                                        <Input
                                            type="number"
                                            placeholder="5000"
                                            value={policyForm.payload.targetAmount || ""}
                                            onChange={(e) => setPolicyForm({ ...policyForm, payload: { ...policyForm.payload, targetAmount: Number(e.target.value) } })}
                                            className="pl-7 font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-sm">
                            <p className="text-[9px] font-mono text-indigo-400 uppercase leading-relaxed">
                                <Gavel className="w-3 h-3 inline mr-1" /> 50%+ manager votes required. 72-hour voting window. Your vote is auto-cast as &quot;approve&quot;.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="font-mono text-[10px] uppercase" onClick={() => { setShowPolicyDialog(false); setPolicyForm({ actionType: "custom", title: "", description: "", payload: {} }); }}>Cancel</Button>
                        <Button
                            className="font-mono text-[10px] uppercase gap-2"
                            disabled={!policyForm.title || !policyForm.description}
                            onClick={async () => {
                                try {
                                    await createPolicyProposal({
                                        groupId,
                                        actionType: policyForm.actionType,
                                        title: policyForm.title,
                                        description: policyForm.description,
                                        policyPayload: Object.keys(policyForm.payload).length > 0 ? policyForm.payload : undefined,
                                    });
                                    toast.success("Policy proposal created! Managers will now vote.");
                                    setShowPolicyDialog(false);
                                    setPolicyForm({ actionType: "custom", title: "", description: "", payload: {} });
                                } catch (e: any) {
                                    toast.error(e.message || "Failed to create proposal");
                                }
                            }}
                        >
                            <ScrollText className="w-3 h-3" /> Submit Proposal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

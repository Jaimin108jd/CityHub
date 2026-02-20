"use client";

import { cn } from "@/lib/utils";
import { Crown, Shield, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHoverCard } from "../../UserHoverCard";

interface Member {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    role?: string;
    joinedAt?: number;
    bio?: string;
    city?: string;
}

interface MobileMemberListProps {
    members: Member[];
    onlineSet: Set<string>;
}

function RoleBadge({ role }: { role?: string }) {
    if (role === "founder") return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Crown className="w-2.5 h-2.5 fill-current" /> Founder
        </span>
    );
    if (role === "manager") return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
            <Shield className="w-2.5 h-2.5" /> Manager
        </span>
    );
    return null;
}

function MemberRow({ member, isOnline }: { member: Member; isOnline: boolean }) {
    return (
        <UserHoverCard
            userId={member.userId}
            name={member.name}
            avatarUrl={member.avatarUrl ?? undefined}
            role={member.role as "founder" | "manager" | "member"}
            joinedAt={member.joinedAt}
            bio={member.bio}
            city={member.city}
            side="left"
        >
            <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer w-full",
                "hover:bg-muted/50",
                !isOnline && "opacity-50"
            )}>
                <div className="relative shrink-0">
                    <Avatar className="w-9 h-9 border border-border/50">
                        <AvatarImage src={member.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {member.name[0]?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className={cn(
                        "absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-background rounded-full transition-colors",
                        isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                            "text-sm font-medium truncate max-w-32",
                            isOnline ? "text-foreground" : "text-muted-foreground"
                        )}>
                            {member.name}
                        </span>
                        <RoleBadge role={member.role} />
                    </div>
                    {member.city && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-muted-foreground/50" />
                            <span className="text-[11px] text-muted-foreground/60 truncate">{member.city}</span>
                        </div>
                    )}
                </div>
                {isOnline && (
                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                )}
            </div>
        </UserHoverCard>
    );
}

export function MobileMemberList({ members, onlineSet }: MobileMemberListProps) {
    const online = members.filter(m => onlineSet.has(m.userId));
    const offline = members.filter(m => !onlineSet.has(m.userId));

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Stats bar */}
            <div className="px-4 pt-5 pb-2 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span className="text-xs font-semibold text-foreground">{online.length} online</span>
                    </div>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground">{members.length} total</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
                {online.length > 0 && (
                    <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 pt-2 pb-1">
                            Online — {online.length}
                        </p>
                        {online.map(m => <MemberRow key={m.userId} member={m} isOnline={true} />)}
                    </>
                )}
                {offline.length > 0 && (
                    <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 px-2 pt-4 pb-1">
                            Offline — {offline.length}
                        </p>
                        {offline.map(m => <MemberRow key={m.userId} member={m} isOnline={false} />)}
                    </>
                )}
            </div>
        </div>
    );
}
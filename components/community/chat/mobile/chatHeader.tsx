"use client";

import { Hash, Volume2, Bell, BellOff, Users, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MobileChatHeaderProps {
    channelName: string;
    isManagerOnly: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    onOpenMembers: () => void;
    onBack?: () => void;
    memberCount?: number;
}

export function MobileChatHeader({
    channelName, isManagerOnly, isMuted, onToggleMute, onOpenMembers, onBack, memberCount,
}: MobileChatHeaderProps) {
    return (
        <div className="h-12 flex items-center justify-between px-3 bg-background/80 backdrop-blur-sm border-b border-border/60 shrink-0 z-10">
            {/* Channel info */}
            <div className="flex items-center gap-1.5 min-w-0">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 -ml-1">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                )}
                <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                    isManagerOnly ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                )}>
                    {isManagerOnly ? <Volume2 className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate block leading-tight">
                        {channelName}
                    </span>
                    {isManagerOnly && (
                        <span className="text-[10px] text-amber-600/80 font-medium leading-none">
                            Announcements
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleMute}
                    className={cn(
                        "h-8 w-8 rounded-xl transition-all",
                        isMuted
                            ? "text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                            : "text-primary bg-primary/10 hover:bg-primary/20"
                    )}
                >
                    {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenMembers}
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                    <div className="relative">
                        <Users className="w-4 h-4" />
                        {memberCount != null && (
                            <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-muted-foreground/20 text-muted-foreground rounded-full min-w-[13px] h-[13px] flex items-center justify-center">
                                {memberCount > 99 ? "99+" : memberCount}
                            </span>
                        )}
                    </div>
                </Button>
            </div>
        </div>
    );
}
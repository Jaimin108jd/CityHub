"use client";

import { Hash, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomBarProps {
    activeTab: "channels" | "chat" | "members";
    onTabChange: (tab: "channels" | "chat" | "members") => void;
    unreadCount?: number;
}

export function MobileBottomBar({ activeTab, onTabChange, unreadCount = 0 }: MobileBottomBarProps) {
    const tabs = [
        { id: "channels" as const, icon: Hash, label: "Channels" },
        { id: "chat" as const, icon: MessageSquare, label: "Chat", badge: unreadCount },
        { id: "members" as const, icon: Users, label: "Members" },
    ];

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/60 flex items-center justify-around px-2"
            style={{ height: '56px', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
        >
            {tabs.map(({ id, icon: Icon, label, badge }) => {
                const isActive = activeTab === id;
                return (
                    <button
                        key={id}
                        onClick={() => onTabChange(id)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all duration-200 rounded-xl mx-1",
                            isActive ? "text-primary" : "text-muted-foreground/70"
                        )}
                    >
                        <div className={cn(
                            "relative flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200",
                            isActive && "bg-primary/10"
                        )}>
                            <Icon className={cn("w-5 h-5 transition-all", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 1.8} />
                            {badge != null && badge > 0 && (
                                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1">
                                    {badge > 99 ? "99+" : badge}
                                </span>
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] transition-all",
                            isActive ? "font-semibold opacity-100" : "font-medium opacity-60"
                        )}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
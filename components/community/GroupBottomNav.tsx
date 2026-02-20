"use client";

import { Users, Eye, MessageSquare, Calendar, Shield, History } from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_CONFIG = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "town-hall", label: "Town Hall", icon: MessageSquare },
    { id: "events", label: "Events", icon: Calendar },
    { id: "members", label: "Members", icon: Users },
    { id: "governance", label: "Governance", icon: Shield },
    { id: "logs", label: "Logs", icon: History },
] as const;

type TabId = (typeof TAB_CONFIG)[number]["id"];

interface GroupBottomNavProps {
    activeTab: TabId;
    onTabChange: (tabId: TabId) => void;
}

export function GroupBottomNav({ activeTab, onTabChange }: GroupBottomNavProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg md:hidden z-50">
            <nav className="flex items-center justify-between px-2 h-16 overflow-x-auto scrollbar-hide">
                {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onTabChange(id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-colors px-2 min-w-[64px]",
                                isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("w-5 h-5", isActive && "fill-current")} />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">{label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

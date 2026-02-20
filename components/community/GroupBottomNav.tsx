"use client";

import { cn } from "@/lib/utils";
import { Eye, MessageSquare, Calendar, Users, Shield, History } from "lucide-react";

export type GroupTabId = "overview" | "town-hall" | "events" | "members" | "governance" | "logs";

interface GroupBottomNavProps {
    activeTab: string;
    onTabChange: (tabId: GroupTabId) => void;
    className?: string;
}

const TAB_CONFIG = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "town-hall", label: "Town Hall", icon: MessageSquare },
    { id: "events", label: "Events", icon: Calendar },
    { id: "members", label: "Members", icon: Users },
    { id: "governance", label: "Governance", icon: Shield },
    { id: "logs", label: "Logs", icon: History },
] as const;

export function GroupBottomNav({ activeTab, onTabChange, className }: GroupBottomNavProps) {
    return (
        <div className={cn("md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border/50 pb-safe", className)}>
            <nav className="flex items-center justify-around px-2 ">
                {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onTabChange(id as GroupTabId)}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all relative flex-1 min-w-0",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                            )}
                        >
                            <div className={cn(
                                "p-1 rounded-full transition-colors",
                                isActive ? "bg-primary/10" : "bg-transparent"
                            )}>
                                <Icon className={cn("w-5 h-5", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={cn("text-[10px] font-medium truncate w-full text-center", isActive ? "font-bold" : "")}>{label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

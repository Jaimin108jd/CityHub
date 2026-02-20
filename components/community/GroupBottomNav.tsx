"use client";

import { Users, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_CONFIG = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "members", label: "Members", icon: Users },
] as const;

type TabId = (typeof TAB_CONFIG)[number]["id"];

interface GroupBottomNavProps {
    activeTab: TabId;
    onTabChange: (tabId: TabId) => void;
}

export function GroupBottomNav({ activeTab, onTabChange }: GroupBottomNavProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg md:hidden z-50">
            <nav className="grid grid-cols-2 h-16">
                {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onTabChange(id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-colors",
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

"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Shield, User, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { UserProfileDrawer } from "./UserProfileDrawer";

interface UserHoverCardProps {
    userId: string;
    name: string;
    avatarUrl?: string;
    role?: "founder" | "manager" | "member";
    joinedAt?: number;
    bio?: string;
    city?: string;
    children: React.ReactNode;
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

const ROLE_CONFIG = {
    founder: { label: "Founder", icon: Crown, color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25" },
    manager: { label: "Manager", icon: Shield, color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/25" },
    member: { label: "Member", icon: User, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
} as const;

// Random banner colors for users without custom banners
const BANNER_COLORS = [
    "from-indigo-600 to-purple-500",
    "from-emerald-600 to-teal-500",
    "from-rose-600 to-pink-500",
    "from-amber-600 to-orange-500",
    "from-cyan-600 to-blue-500",
    "from-fuchsia-600 to-violet-500",
];

function getBannerColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return BANNER_COLORS[Math.abs(hash) % BANNER_COLORS.length];
}

export function UserHoverCard({
    userId, name, avatarUrl, role, joinedAt, bio, city,
    children, className, side = "bottom"
}: UserHoverCardProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [isOpen, setIsOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dynamicSide, setDynamicSide] = useState<"top" | "bottom" | "left" | "right">(side);

    const calculatePosition = () => {
        if (!containerRef.current || !isDesktop) return;
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        if (side === "bottom" && spaceBelow < 280) setDynamicSide("top");
        else if (side === "top" && rect.top < 280) setDynamicSide("bottom");
        else if (side === "left" && rect.left < 320) setDynamicSide("right");
        else setDynamicSide(side);
    };

    const handleEnter = () => {
        if (!isDesktop) return;
        calculatePosition();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsOpen(true), 250);
    };

    const handleLeave = () => {
        if (!isDesktop) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsOpen(false), 100);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (!isDesktop) {
            e.preventDefault();
            e.stopPropagation();
            setIsDrawerOpen(true);
        }
    };

    const r = role ? ROLE_CONFIG[role] : ROLE_CONFIG.member;
    const bannerGradient = getBannerColor(name);

    return (
        <>
            <div
                ref={containerRef}
                className="relative inline-block"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
                onClick={handleClick}
            >
                <div className={cn("cursor-pointer", className)}>
                    {children}
                </div>

                {isOpen && isDesktop && (
                    <div
                        className={cn(
                            "absolute z-[100] w-75 rounded-lg overflow-hidden",
                            "bg-[hsl(var(--card))] border border-border/50",
                            "shadow-[0_8px_32px_rgba(0,0,0,0.24)]",
                            "animate-in fade-in zoom-in-95 duration-150",
                            dynamicSide === "bottom" && "left-1/2 -translate-x-1/2 top-full mt-2",
                            dynamicSide === "top" && "left-1/2 -translate-x-1/2 bottom-full mb-2",
                            dynamicSide === "left" && "right-full top-0 mr-2",
                            dynamicSide === "right" && "left-full top-0 ml-2",
                        )}
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                    >
                        {/* ── Banner ── */}
                        <div className={cn("h-[60px] bg-linear-to-r", bannerGradient)} />

                        {/* ── Avatar (overlaps banner) ── */}
                        <div className="px-4 relative">
                            <div className="-mt-8 mb-2 flex items-end justify-between">
                                <div className="relative">
                                    <div className="size-18 rounded-full bg-[hsl(var(--card))] p-1">
                                        <Avatar className="w-full h-full">
                                            {avatarUrl && <AvatarImage src={avatarUrl} />}
                                            <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
                                                {name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    {/* Status dot */}
                                    <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-[3px] border-[hsl(var(--card))] bg-emerald-500" />
                                </div>

                                {/* Role badge (top right, next to avatar row) */}
                                {role && role !== "member" && (
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border mb-2",
                                        r.bg, r.color, r.border
                                    )}>
                                        <r.icon className="w-3 h-3" />
                                        {r.label}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Info card body ── */}
                        <div className="mx-3 mb-3 p-3 rounded-lg bg-background border border-border/50 space-y-2.5">
                            {/* Name */}
                            <div>
                                <h3 className="font-bold text-base text-foreground leading-tight">{name}</h3>
                                <p className="text-xs text-muted-foreground">{name.toLowerCase().replace(/\s+/g, "")}</p>
                            </div>

                            <div className="h-px bg-border/60" />

                            {/* Bio */}
                            {bio && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">About Me</p>
                                    <p className="text-[13px] text-foreground/80 leading-relaxed line-clamp-3">{bio}</p>
                                </div>
                            )}

                            {/* Meta */}
                            <div className="space-y-1.5">
                                {city && (
                                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                        <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                                        <span>{city}</span>
                                    </div>
                                )}
                                {joinedAt && (
                                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                                        <span>Joined {new Date(joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                    </div>
                                )}
                            </div>

                            {/* Role (for regular members) */}
                            {role === "member" && (
                                <>
                                    <div className="h-px bg-border/60" />
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Role</p>
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border",
                                            r.bg, r.color, r.border
                                        )}>
                                            <r.icon className="w-3 h-3" />
                                            {r.label}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <UserProfileDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                user={{ userId, name, avatarUrl, role, joinedAt, bio, city }}
            />
        </>
    );
}

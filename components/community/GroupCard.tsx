"use client";

import Link from "next/link";
import { memo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Lock, Globe, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupCardProps {
    group: {
        _id: Id<"groups">;
        name: string;
        description: string;
        category: string;
        tags: string[];
        city: {
            name: string;
            country: string;
            state?: string;
        };
        coverImageUrl: string | null;
        memberCount: number;
        isPublic: boolean;
        myRole?: string;
    };
}

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

export const GroupCard = memo(function GroupCard({ group }: GroupCardProps) {
    const emoji = CATEGORY_EMOJI[group.category] || "📌";

    return (
        <Link href={`/community/${group._id}`} className="block h-full">
            <article
                className={cn(
                    "group relative h-full flex flex-col",
                    "rounded-xl border border-border/60 bg-card",
                    "transition-all duration-300 ease-out",
                    "hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]",
                    "hover:-translate-y-0.5",
                    "overflow-hidden"
                )}
            >
                {/* ── Cover ── */}
                <div className="relative h-32 sm:h-36 overflow-hidden bg-muted">
                    {group.coverImageUrl ? (
                        <img
                            src={group.coverImageUrl}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-muted via-muted to-muted/70 flex items-center justify-center">
                            <span className="text-5xl opacity-[0.08] select-none">{emoji}</span>
                        </div>
                    )}

                    {/* Scrim — only on bottom for text readability */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/50 to-transparent" />

                    {/* Floating category pill */}
                    <div className="absolute top-2.5 left-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md text-white text-[10px] font-semibold tracking-wide">
                            <span className="text-xs leading-none">{emoji}</span>
                            {group.category}
                        </span>
                    </div>

                    {/* Visibility icon */}
                    <div className="absolute top-2.5 right-2.5">
                        <span
                            className={cn(
                                "inline-flex items-center justify-center w-6 h-6 rounded-full backdrop-blur-md",
                                group.isPublic
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-amber-500/20 text-amber-300"
                            )}
                        >
                            {group.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        </span>
                    </div>

                    {/* Role chip (bottom-left, on scrim) */}
                    {group.myRole && (
                        <div className="absolute bottom-2.5 left-2.5">
                            <Badge
                                variant="secondary"
                                className="text-[9px] font-bold uppercase tracking-wider bg-white/90 text-foreground border-0 shadow-sm px-2 py-0.5"
                            >
                                {group.myRole === "founder" ? "👑 Founder" : group.myRole === "manager" ? "⚡ Manager" : group.myRole}
                            </Badge>
                        </div>
                    )}

                    {/* Member count (bottom-right, on scrim) */}
                    <div className="absolute bottom-2.5 right-2.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/90">
                            <Users className="w-3 h-3" />
                            {group.memberCount}
                        </span>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-col flex-1 p-3.5 pt-3 gap-2.5">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[15px] leading-snug text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {group.name}
                        </h3>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300" />
                    </div>

                    {/* Description */}
                    <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
                        {group.description}
                    </p>

                    {/* Spacer to push footer down */}
                    <div className="flex-1" />

                    {/* Tags */}
                    {group.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            {group.tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0"
                                >
                                    #{tag}
                                </span>
                            ))}
                            {group.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                    +{group.tags.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="text-xs truncate">{group.city.name}</span>
                        {group.city.state && (
                            <>
                                <span className="text-border">·</span>
                                <span className="text-xs truncate">{group.city.state}</span>
                            </>
                        )}
                    </div>
                </div>
            </article>
        </Link>
    );
});

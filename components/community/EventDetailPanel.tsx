"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    Calendar,
    ArrowRight,
    MapPin,
    Camera,
    Globe,
    ChevronLeft,
    Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryStyle } from "./map-utils";

interface EventDetailPanelProps {
    event: any;
    onClose: () => void;
    onNavigateToGroup: (groupId: string) => void;
}

export default function EventDetailPanel({
    event,
    onClose,
    onNavigateToGroup,
}: EventDetailPanelProps) {
    const date = new Date(event.startTime);
    const style = getCategoryStyle(event.category);
    const isPast = event.isPast;
    const eventStatus = event.status === "cancelled" ? "cancelled"
        : event.status === "completed" || isPast ? "completed"
            : event.startTime <= Date.now() ? "ongoing"
                : "upcoming";
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; className?: string }> = {
        upcoming: { label: "Upcoming", variant: "default" },
        ongoing: { label: "Live Now", variant: "default", className: "bg-amber-500 hover:bg-amber-500/90 text-white border-amber-500 animate-pulse" },
        completed: { label: "Past Event", variant: "secondary" },
        cancelled: { label: "Cancelled", variant: "destructive", className: "bg-red-500/10 text-red-500 border-red-500/30" },
    };
    const sc = statusConfig[eventStatus];
    const photoUrls = (event.photoUrls || []).filter((u: string | null) => typeof u === "string" && u.length > 0);

    // Relative time
    const relativeLabel = (() => {
        if (eventStatus === "ongoing") return "Happening now";
        if (eventStatus !== "upcoming") return null;
        const diff = event.startTime - Date.now();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return "Today";
        if (days === 1) return "Tomorrow";
        if (days < 7) return `In ${days} days`;
        return null;
    })();

    return (
        <div className="absolute right-0 top-0 bottom-0 w-95 max-w-[90vw] bg-background/95 backdrop-blur-xl border-l border-border z-1000 overflow-y-auto animate-in slide-in-from-right-full duration-300">
            {/* Header with photo grid */}
            {photoUrls.length > 0 ? (
                <div className="relative">
                    <div className={cn(
                        "grid gap-0.5",
                        photoUrls.length === 1 && "grid-cols-1",
                        photoUrls.length === 2 && "grid-cols-2",
                        photoUrls.length >= 3 && "grid-cols-2 grid-rows-2"
                    )}>
                        {photoUrls.slice(0, 4).map((url: string, i: number) => (
                            <div key={i} className={cn(
                                "overflow-hidden bg-muted",
                                photoUrls.length === 1 && "h-48",
                                photoUrls.length === 2 && "h-40",
                                photoUrls.length >= 3 && "h-28",
                                i === 0 && photoUrls.length >= 3 && "row-span-2 h-full"
                            )}>
                                <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                            </div>
                        ))}
                    </div>
                    {event.photoCount > 4 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded-md backdrop-blur-sm">
                            +{event.photoCount - 4} more
                        </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-transparent pointer-events-none" />
                    <button
                        onClick={onClose}
                        className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="h-36 bg-linear-to-br from-primary/10 via-primary/5 to-muted relative flex items-center justify-center">
                    <Calendar className="w-14 h-14 text-muted-foreground/10" />
                    <button
                        onClick={onClose}
                        className="absolute top-3 left-3 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm text-foreground flex items-center justify-center hover:bg-background/80 transition-colors border border-border"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="p-5 space-y-4">
                {/* Status & Category */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={sc.variant} className={cn("text-[9px] font-mono uppercase shadow-sm", sc.className)}>
                        {sc.label}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[9px] font-mono uppercase", style.text, style.border, style.bg)}>
                        {event.category}
                    </Badge>
                    {event.isPaid && (
                        <Badge variant="outline" className="text-[9px] font-mono text-emerald-500 border-emerald-500/30 bg-emerald-500/5">
                            ₹{event.price}
                        </Badge>
                    )}
                    {event.isTravelEvent && (
                        <Badge className="text-[9px] font-mono uppercase gap-0.5 bg-violet-500/90 text-white border-none shadow-sm">
                            <Plane className="w-3 h-3" /> Travel
                        </Badge>
                    )}
                </div>

                {/* Title + relative time */}
                <div>
                    <h2 className="text-lg font-bold tracking-tight uppercase font-mono leading-tight">
                        {event.title}
                    </h2>
                    {relativeLabel && (
                        <p className={cn(
                            "text-xs font-mono mt-1",
                            eventStatus === "ongoing" ? "text-amber-500 font-bold" : "text-primary"
                        )}>
                            {eventStatus === "ongoing" && "● "}{relativeLabel}
                        </p>
                    )}
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex items-start gap-2.5 p-3 bg-muted/20 border border-border rounded-xl">
                        <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">{date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 bg-muted/20 border border-border rounded-xl">
                        <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-bold truncate">{event.location}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                                {event.eventType === "in-person" ? "In-Person" : "Online"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 bg-muted/20 border border-border rounded-xl">
                        <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">{event.attendeeCount}{event.capacity ? ` / ${event.capacity}` : ""}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{eventStatus === "completed" ? "Attended" : "Going"}</p>
                        </div>
                    </div>
                    {event.photoCount > 0 && (
                        <div className="flex items-start gap-2.5 p-3 bg-muted/20 border border-border rounded-xl">
                            <Camera className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold">{event.photoCount}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">Photos</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* In-Person Location Card */}
                {event.eventType === "in-person" && event.locationCoords && (
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${event.locationCoords.lat},${event.locationCoords.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors group/loc"
                    >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate group-hover/loc:text-primary transition-colors">{event.location}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">Open in Google Maps →</p>
                        </div>
                    </a>
                )}

                {/* Description */}
                {event.description && (
                    <p className="text-sm text-muted-foreground/80 leading-relaxed line-clamp-4">{event.description}</p>
                )}

                {/* View Details button */}
                <Button
                    className="w-full h-10 font-mono text-xs uppercase gap-2 rounded-xl shadow-lg shadow-primary/20"
                    onClick={() => onNavigateToGroup(`${event.groupId}/events/${event._id}`)}
                >
                    View Details <ArrowRight className="w-3 h-3" />
                </Button>

                {/* Group Link */}
                <button
                    onClick={() => onNavigateToGroup(event.groupId)}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/40 transition-colors group/link"
                >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold truncate group-hover/link:text-primary transition-colors">{event.groupName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-mono">
                            {event.groupCategory}{event.isTravelEvent && event.groupCity ? ` · Based in ${event.groupCity}` : ""}
                        </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors" />
                </button>
            </div>
        </div>
    );
}

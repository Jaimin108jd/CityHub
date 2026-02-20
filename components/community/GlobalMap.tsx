"use client";

import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    Map,
    MapMarker,
    MapPopup,
    MapTileLayer,
    MapZoomControl,
    MapFullscreenControl,
    MapLocateControl,
    MapMarkerClusterGroup,
    MapTooltip,
} from "@/components/ui/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    Calendar,
    ArrowRight,
    MapPin,
    Camera,
    Clock,
    Filter,
    X,
    Search,
    Sparkles,
    Zap,
    Globe,
    Image as ImageIcon,
    ChevronLeft,
    Plane,
    Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import dynamic from "next/dynamic";
import { CATEGORIES, getCategoryStyle } from "./map-utils";

const EventDetailPanel = dynamic(() => import("./EventDetailPanel"), { ssr: false });

// ── Custom animated event pin ──
function EventPinIcon({ category, status, hasPhotos }: { category: string; status: string; hasPhotos: boolean }) {
    const color = status === "cancelled" ? "#9ca3af" : getCategoryStyle(category).pin;
    const isDone = status === "completed" || status === "cancelled";
    return (
        <div className="relative group" style={{ width: 32, height: 40 }}>
            {/* Pulse ring for upcoming/ongoing events */}
            {!isDone && (
                <div
                    className={cn("absolute inset-0 rounded-full opacity-20", status === "ongoing" ? "animate-pulse" : "animate-ping")}
                    style={{ backgroundColor: status === "ongoing" ? "#f59e0b" : color, width: 32, height: 32 }}
                />
            )}
            {/* Pin body */}
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
                <path
                    d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z"
                    fill={color}
                    opacity={isDone ? 0.5 : 0.9}
                />
                <circle cx="16" cy="15" r="7" fill="white" opacity="0.9" />
                {/* Inner icon indicator */}
                {hasPhotos ? (
                    <rect x="12" y="11" width="8" height="8" rx="1" fill={color} opacity="0.7" />
                ) : (
                    <circle cx="16" cy="15" r="3" fill={color} opacity="0.7" />
                )}
            </svg>
            {/* Photo indicator badge */}
            {hasPhotos && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center">
                    <Camera style={{ width: 8, height: 8, color: "white" }} />
                </div>
            )}
        </div>
    );
}

// ── Main Activity Map Component ──
export function GlobalMap({ className }: { className?: string }) {
    const router = useRouter();

    // State
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Semantic search state
    const [semanticEventResults, setSemanticEventResults] = useState<any[] | null>(null);
    const [isSemanticSearching, setIsSemanticSearching] = useState(false);
    const semanticSearch = useAction(api.ai.semanticSearch);
    const semanticTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Queries
    const events = useQuery(api.events.getAllEventsForMap, {
        filterStatus: filterStatus === "all" ? undefined : filterStatus,
        filterCategory: filterCategory === "all" ? undefined : filterCategory,
    });
    const groups = useQuery(api.groups.listPublicGroups, {});
    const cityMemories = useQuery(api.events.getCityMemory, {});

    // Text-based filter
    const textFilteredEvents = useMemo(() => {
        if (!events) return [];
        if (!deferredSearchQuery.trim()) return events;
        const q = deferredSearchQuery.toLowerCase();
        return events.filter(
            (e) =>
                e.title.toLowerCase().includes(q) ||
                e.groupName.toLowerCase().includes(q) ||
                e.location.toLowerCase().includes(q) ||
                e.category?.toLowerCase().includes(q)
        );
    }, [events, deferredSearchQuery]);

    // Trigger semantic search for map events (debounced)
    useEffect(() => {
        if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);

        if (!deferredSearchQuery.trim() || deferredSearchQuery.trim().length < 2) {
            setSemanticEventResults(null);
            setIsSemanticSearching(false);
            return;
        }

        setIsSemanticSearching(true);
        semanticTimerRef.current = setTimeout(async () => {
            try {
                const results = await semanticSearch({ query: deferredSearchQuery, limit: 20 });
                setSemanticEventResults(results.events as any[]);
            } catch {
                setSemanticEventResults(null);
            } finally {
                setIsSemanticSearching(false);
            }
        }, 400);

        return () => {
            if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);
        };
    }, [deferredSearchQuery, semanticSearch]);

    // Merge semantic event results with text filter
    const filteredEvents = useMemo(() => {
        if (!deferredSearchQuery.trim()) return events ?? [];

        if (semanticEventResults && semanticEventResults.length > 0 && events) {
            const semanticIds = new Set(semanticEventResults.map((e) => e._id));
            const seenIds = new Set<string>();
            const merged: any[] = [];

            // Semantic matches from the full events list (to get complete data)
            for (const e of events) {
                if (semanticIds.has(e._id) && !seenIds.has(e._id)) {
                    seenIds.add(e._id);
                    merged.push(e);
                }
            }
            // Then text matches
            for (const e of textFilteredEvents) {
                if (!seenIds.has(e._id)) {
                    seenIds.add(e._id);
                    merged.push(e);
                }
            }
            return merged;
        }

        return textFilteredEvents;
    }, [events, deferredSearchQuery, semanticEventResults, textFilteredEvents]);

    // Separate into events with coords and groups
    const mapEvents = useMemo(
        () => filteredEvents.filter((e) => e.locationCoords),
        [filteredEvents]
    );

    // Stats
    const stats = useMemo(() => {
        if (!events) return { total: 0, upcoming: 0, past: 0, photos: 0, groups: 0 };
        return {
            total: events.length,
            upcoming: events.filter((e) => !e.isPast).length,
            past: events.filter((e) => e.isPast).length,
            photos: events.reduce((sum, e) => sum + e.photoCount, 0),
            groups: new Set(events.map((e) => e.groupId)).size,
        };
    }, [events]);

    // Center on user's city or default
    const center: [number, number] = useMemo(() => {
        if (mapEvents.length > 0 && mapEvents[0].locationCoords) {
            return [mapEvents[0].locationCoords.lat, mapEvents[0].locationCoords.lon];
        }
        if (groups && groups.length > 0 && groups[0].city) {
            return [groups[0].city.lat, groups[0].city.lon];
        }
        return [19.0760, 72.8777]; // Mumbai fallback
    }, [mapEvents, groups]);

    const handleNavigateToGroup = useCallback(
        (groupId: string) => router.push(`/community/${groupId}`),
        [router]
    );

    return (
        <div className={cn("relative w-full h-full bg-background font-mono overflow-hidden", className)}>
            <Map center={center} zoom={12} className="w-full h-full">
                <MapTileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <MapZoomControl position="bottomleft" />
                <MapFullscreenControl position="topright" />
                <MapLocateControl position="bottomleft" watch autoStart />

                {/* Event Markers with Clustering */}
                <MapMarkerClusterGroup>
                    {mapEvents.map((event) => (
                        <MapMarker
                            key={event._id}
                            position={[event.locationCoords!.lat, event.locationCoords!.lon]}
                            icon={
                                <EventPinIcon
                                    category={event.category}
                                    status={event.status}
                                    hasPhotos={event.photoCount > 0}
                                />
                            }
                            iconAnchor={[16, 40]}
                            popupAnchor={[0, -40]}
                            eventHandlers={{
                                click: () => setSelectedEvent(event),
                            }}
                        >
                            <MapTooltip className="bg-background! text-foreground! border-border! font-mono! text-[10px]! uppercase! rounded-md! shadow-xl! px-2.5! py-1.5!">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: getCategoryStyle(event.category).pin }}
                                    />
                                    <span className="font-bold">{event.title}</span>
                                    <span className="text-muted-foreground">· {event.attendeeCount}</span>
                                </div>
                            </MapTooltip>
                        </MapMarker>
                    ))}
                </MapMarkerClusterGroup>

                {/* City Memory Markers (Feature 4: Public City Stats) */}
                {cityMemories?.map((memory) => (
                    <MapMarker
                        key={`memory-${memory.cityName}-${memory.country}`}
                        position={[memory.lat, memory.lon]}
                        icon={
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-linear-to-tr from-amber-500/30 to-purple-500/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="w-10 h-10 rounded-full bg-background border-2 border-amber-500 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)] relative z-10 overflow-hidden transform group-hover:scale-110 transition-transform duration-300">
                                    <div className="absolute inset-0 bg-linear-to-tr from-amber-500/10 to-transparent" />
                                    <Sparkles className="w-5 h-5 text-amber-500 drop-shadow-sm" />
                                </div>
                                {/* City Impact Badge */}
                                <div className="absolute top-1/2 left-full w-max -translate-y-1/2 ml-3 bg-background/95 backdrop-blur-xl border border-amber-500/40 px-2.5 py-1.5 rounded-md shadow-xl pointer-events-none opacity-0 translate-x-[-10px] group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 font-mono flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5" /> Civic Impact Zone
                                    </p>
                                </div>
                            </div>
                        }
                        iconAnchor={[20, 20]}
                        popupAnchor={[0, -20]}
                    >
                        <MapPopup className="p-0 border-none bg-transparent shadow-none">
                            <div className="w-72 overflow-hidden rounded-xl border border-amber-500/30 bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200">
                                <div className="bg-linear-to-br from-amber-500/10 to-purple-500/5 p-4 border-b border-border relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Globe className="w-16 h-16" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-2 relative z-10">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        <h3 className="font-bold uppercase tracking-widest text-xs font-mono text-amber-500">City Memory Log</h3>
                                    </div>
                                    <p className="font-bold text-xl mb-0.5 tracking-tight relative z-10">{memory.cityName}, {memory.country}</p>
                                </div>
                                <div className="p-4 space-y-5">
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        <div className="space-y-1 p-2.5 bg-muted/40 rounded-lg border border-border/60">
                                            <p className="text-[9px] text-muted-foreground font-mono uppercase font-bold tracking-wider flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" /> Events Hosted
                                            </p>
                                            <p className="text-xl font-black text-primary font-mono">{memory.totalEvents}</p>
                                        </div>
                                        <div className="space-y-1 p-2.5 bg-muted/40 rounded-lg border border-border/60">
                                            <p className="text-[9px] text-muted-foreground font-mono uppercase font-bold tracking-wider flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" /> Total Attendees
                                            </p>
                                            <p className="text-xl font-black text-emerald-500 font-mono">{memory.totalAttendees}</p>
                                        </div>
                                        <div className="space-y-1 p-2.5 bg-muted/40 rounded-lg border border-border/60">
                                            <p className="text-[9px] text-muted-foreground font-mono uppercase font-bold tracking-wider flex items-center gap-1">
                                                <Globe className="w-3.5 h-3.5" /> Active Hubs
                                            </p>
                                            <p className="text-xl font-black text-blue-500 font-mono">{memory.groupCount}</p>
                                        </div>
                                        <div className="space-y-1 p-2.5 bg-muted/40 rounded-lg border border-border/60">
                                            <p className="text-[9px] text-muted-foreground font-mono uppercase font-bold tracking-wider flex items-center gap-1">
                                                <Camera className="w-3.5 h-3.5" /> Photo Archive
                                            </p>
                                            <p className="text-xl font-black text-purple-500 font-mono">{memory.totalPhotos}</p>
                                        </div>
                                    </div>

                                    {memory.recentEvents.length > 0 && (
                                        <div className="space-y-2.5 pt-4 border-t border-border">
                                            <p className="text-[10px] text-muted-foreground font-mono uppercase font-bold tracking-widest">Recent Impact</p>
                                            <div className="space-y-3">
                                                {memory.recentEvents.slice(0, 3).map((re: any, i: number) => (
                                                    <div key={i} className="flex flex-col gap-1">
                                                        <p className="text-xs font-bold line-clamp-1">{re.title}</p>
                                                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono uppercase">
                                                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {re.attendeeCount}</span>
                                                            <span className="w-1 h-1 rounded-full bg-border" />
                                                            <span>By {re.groupName}</span>
                                                            <span className="w-1 h-1 rounded-full bg-border" />
                                                            <span>{new Date(re.startTime).toLocaleString("default", { month: "short", year: "numeric" })}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </MapPopup>
                    </MapMarker>
                ))}

                {/* Community Hub Markers (smaller, secondary) */}
                {groups?.filter((g) => g.city.lat && g.city.lon).map((group) => (
                    <MapMarker
                        key={`group-${group._id}`}
                        position={[group.city.lat!, group.city.lon!]}
                        icon={
                            <div className="w-6 h-6 rounded-full bg-background border-2 border-primary/40 flex items-center justify-center shadow-lg">
                                <Globe style={{ width: 12, height: 12, color: "hsl(var(--primary))" }} />
                            </div>
                        }
                        iconAnchor={[12, 12]}
                        popupAnchor={[0, -12]}
                    >
                        <MapPopup className="p-0 border-none bg-transparent shadow-none">
                            <div className="w-56 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200">
                                <div className="p-3 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <Badge variant="outline" className="text-[8px] uppercase font-mono border-primary/20 bg-primary/5 text-primary">
                                            {group.category}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-mono">
                                            <Users className="w-3 h-3" /> {group.memberCount}
                                        </div>
                                    </div>
                                    <h3 className="font-bold uppercase tracking-tight text-sm line-clamp-1">{group.name}</h3>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="w-full h-7 text-[10px] uppercase font-mono gap-1.5"
                                        onClick={() => router.push(`/community/${group._id}`)}
                                    >
                                        Enter <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </MapPopup>
                    </MapMarker>
                ))}
            </Map>

            {/* ── TOP BAR: Title + Search + Filter ── */}
            <div className="absolute top-14 left-3 right-3 z-500 pointer-events-none">
                <div className="flex items-start gap-2">
                    {/* Title + Search Card */}
                    <div className="bg-background/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl pointer-events-auto">
                        <div className="flex items-center gap-2 px-3 py-2">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                            <h1 className="text-[11px] font-black uppercase tracking-tighter shrink-0">City Map</h1>
                            <div className="h-4 w-px bg-border/60 shrink-0" />
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                <input
                                    placeholder="AI search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-7 w-36 sm:w-48 pl-7 pr-6 text-[11px] font-mono bg-muted/40 border border-border/50 rounded-lg outline-none focus:border-primary/40 transition-colors"
                                />
                                {isSemanticSearching ? (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                                    </div>
                                ) : searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="h-4 w-px bg-border/60 shrink-0" />
                            {/* Stats */}
                            <div className="hidden sm:flex items-center gap-2.5">
                                {[
                                    { value: stats.total, icon: <Calendar className="w-3 h-3" /> },
                                    { value: stats.upcoming, icon: <Zap className="w-3 h-3" /> },
                                    { value: stats.photos, icon: <Camera className="w-3 h-3" /> },
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center gap-0.5 text-primary">
                                        {s.icon}
                                        <span className="text-[11px] font-bold">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Filter Button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "h-[38px] px-3 rounded-xl border text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 transition-all shadow-xl backdrop-blur-xl pointer-events-auto shrink-0",
                            showFilters
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background/90 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground"
                        )}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Filters</span>
                        {(filterStatus !== "all" || filterCategory !== "all") && (
                            <span className={cn(
                                "w-4 h-4 rounded-full text-[8px] flex items-center justify-center",
                                showFilters ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                            )}>
                                {(filterStatus !== "all" ? 1 : 0) + (filterCategory !== "all" ? 1 : 0)}
                            </span>
                        )}
                    </button>

                    <div className="flex-1" />

                    {/* Legend (top right) */}
                    <div className="bg-background/90 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3 shadow-xl pointer-events-auto hidden md:block">
                        <p className="text-[10px] font-mono font-bold uppercase text-muted-foreground mb-2 tracking-wide">Legend</p>
                        <div className="space-y-1.5">
                            {CATEGORIES.slice(0, 6).map((cat) => (
                                <div key={cat} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: getCategoryStyle(cat).pin }} />
                                    <span className="text-xs font-medium text-foreground/80">{cat}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Expanded Filter Panel */}
                {showFilters && (
                    <div className="mt-2 max-w-md bg-background/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-mono font-bold uppercase text-muted-foreground">Time</label>
                            <div className="flex gap-1.5">
                                {[
                                    { value: "all", label: "All" },
                                    { value: "upcoming", label: "Upcoming" },
                                    { value: "past", label: "Past" },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFilterStatus(opt.value)}
                                        className={cn(
                                            "h-7 px-3 text-[10px] font-mono uppercase rounded-md border transition-all",
                                            filterStatus === opt.value
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted/30 text-muted-foreground border-border hover:border-primary/30"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-mono font-bold uppercase text-muted-foreground">Category</label>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setFilterCategory("all")}
                                    className={cn(
                                        "h-6 px-2 text-[9px] font-mono uppercase rounded-md border transition-all",
                                        filterCategory === "all"
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-muted/30 text-muted-foreground border-border hover:border-primary/30"
                                    )}
                                >
                                    All
                                </button>
                                {CATEGORIES.map((cat) => {
                                    const s = getCategoryStyle(cat);
                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => setFilterCategory(cat)}
                                            className={cn(
                                                "h-6 px-2 text-[9px] font-mono uppercase rounded-md border transition-all flex items-center gap-1",
                                                filterCategory === cat
                                                    ? cn(s.bg, s.text, s.border)
                                                    : "bg-muted/30 text-muted-foreground border-border hover:border-primary/30"
                                            )}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.pin }} />
                                            {cat.length > 12 ? cat.slice(0, 10) + "\u2026" : cat}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {(filterStatus !== "all" || filterCategory !== "all") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-[10px] font-mono uppercase"
                                onClick={() => { setFilterStatus("all"); setFilterCategory("all"); }}
                            >
                                <X className="w-3 h-3 mr-1" /> Clear Filters
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* ── BOTTOM: Event Cards ── */}
            <div className="absolute bottom-3 left-3 right-3 z-500 pointer-events-none">
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar pointer-events-auto">
                    {filteredEvents.slice(0, 20).map((event) => {
                        const date = new Date(event.startTime);
                        const isValidDate = !isNaN(date.getTime());
                        const style = getCategoryStyle(event.category);
                        const isSelected = selectedEvent?._id === event._id;
                        return (
                            <button
                                key={event._id}
                                onClick={() => setSelectedEvent(event)}
                                className={cn(
                                    "shrink-0 w-52 p-2.5 rounded-xl border text-left transition-all",
                                    "bg-background/90 backdrop-blur-xl shadow-xl hover:shadow-2xl",
                                    isSelected
                                        ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                                        : "border-border/50 hover:border-primary/30"
                                )}
                            >
                                <div className="flex items-start gap-2">
                                    <div className={cn("p-1 rounded text-center min-w-8 border", style.bg, style.border)}>
                                        <span className={cn("block text-[7px] uppercase font-bold", style.text)}>
                                            {isValidDate ? date.toLocaleString("default", { month: "short" }).toUpperCase() : "---"}
                                        </span>
                                        <span className={cn("text-xs font-bold", style.text)}>{isValidDate ? date.getDate() : "?"}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase truncate">{event.title}</p>
                                        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{event.groupName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                                                <Users style={{ width: 8, height: 8 }} /> {event.attendeeCount}
                                            </span>
                                            {event.photoCount > 0 && (
                                                <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                                                    <Camera style={{ width: 8, height: 8 }} /> {event.photoCount}
                                                </span>
                                            )}
                                            {event.isPast && (
                                                <span className="text-[8px] text-muted-foreground/60 uppercase">Past</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {filteredEvents.length === 0 && (
                        <div className="shrink-0 w-full p-3 rounded-xl border border-dashed border-border bg-background/80 backdrop-blur-xl text-center">
                            <p className="text-xs text-muted-foreground uppercase font-mono">No events match your filters</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Event Detail Panel ── */}
            {selectedEvent && (
                <EventDetailPanel
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    onNavigateToGroup={handleNavigateToGroup}
                />
            )}
        </div>
    );
}

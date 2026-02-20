"use client";

import { useState, useMemo, useCallback, useDeferredValue, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Search,
    Plus,
    Users,
    Compass,
    FolderOpen,
    Sparkles,
    ArrowRight,
    MapPin,
    Map as MapIcon,
    Loader2,
    Wand2,
    Globe,
    Activity,
    Zap,
} from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useElementSize } from "@/hooks/use-element-size";
import dynamic from "next/dynamic";
import { GroupCard } from "./GroupCard";

const CreateGroupDialog = dynamic(() => import("./CreateGroupDialog").then(mod => mod.CreateGroupDialog), { ssr: false });

const CATEGORIES = [
    { name: "All", icon: Sparkles },
    { name: "Neighborhood", icon: Users },
    { name: "Environment", icon: Zap },
    { name: "Education", icon: Compass },
    { name: "Arts & Culture", icon: Sparkles },
    { name: "Sports & Recreation", icon: Users },
    { name: "Safety & Watch", icon: Shield },
    { name: "Local Business", icon: Zap },
    { name: "Tech & Innovation", icon: Compass },
    { name: "Health & Wellness", icon: Users },
    { name: "Other", icon: Sparkles },
];

function Shield({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

type Tab = "discover" | "my-groups";

export default function CommunityPageContent() {
    const router = useRouter();
    const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    // Semantic search state
    const [semanticResults, setSemanticResults] = useState<any[] | null>(null);
    const [isSemanticSearching, setIsSemanticSearching] = useState(false);
    const semanticSearch = useAction(api.ai.semanticSearch);
    const semanticTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Virtualization setup
    const [containerRef, { width: containerWidth }] = useElementSize();
    const [listOffset, setListOffset] = useState(0);

    const listRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            setListOffset(node.offsetTop);
        }
    }, []);

    const myProfile = useQuery(
        api.users.getMyProfile,
        isAuthenticated ? {} : "skip"
    );

    const publicGroups = useQuery(
        api.groups.listPublicGroups,
        isAuthenticated
            ? selectedCategory === "All"
                ? {}
                : { category: selectedCategory }
            : "skip"
    );

    const myGroups = useQuery(
        api.groups.getMyGroups,
        isAuthenticated ? {} : "skip"
    );

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.replace("/auth/login");
        }
    }, [isAuthLoading, isAuthenticated, router]);

    // Filter by search query (text-based fallback)
    const textFilteredGroups = useMemo(() => {
        if (!publicGroups) return [];
        if (!deferredSearchQuery.trim()) return publicGroups;
        const q = deferredSearchQuery.toLowerCase();
        return publicGroups.filter(
            (g) =>
                g.name.toLowerCase().includes(q) ||
                g.description.toLowerCase().includes(q) ||
                g.tags.some((t: string) => t.includes(q)) ||
                g.city.name.toLowerCase().includes(q)
        );
    }, [publicGroups, deferredSearchQuery]);

    // Trigger semantic search when query changes (debounced)
    useEffect(() => {
        if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);

        if (!deferredSearchQuery.trim() || deferredSearchQuery.trim().length < 2) {
            setSemanticResults(null);
            setIsSemanticSearching(false);
            return;
        }

        setIsSemanticSearching(true);
        semanticTimerRef.current = setTimeout(async () => {
            try {
                const results = await semanticSearch({ query: deferredSearchQuery, limit: 15 });
                setSemanticResults(results.groups as any[]);
            } catch {
                setSemanticResults(null);
            } finally {
                setIsSemanticSearching(false);
            }
        }, 400);

        return () => {
            if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);
        };
    }, [deferredSearchQuery, semanticSearch]);

    // Merge semantic results with text filter (semantic first, deduplicated)
    const filteredPublicGroups = useMemo(() => {
        if (!deferredSearchQuery.trim()) return publicGroups ?? [];

        // If we have semantic results, blend them with text results
        if (semanticResults && semanticResults.length > 0) {
            const seenIds = new Set<string>();
            const merged: any[] = [];

            // Semantic results first (AI-ranked)
            for (const g of semanticResults) {
                if (!seenIds.has(g._id)) {
                    seenIds.add(g._id);
                    merged.push({ ...g, _isSemanticMatch: true });
                }
            }
            // Then text matches that weren't in semantic results
            for (const g of textFilteredGroups) {
                if (!seenIds.has(g._id)) {
                    seenIds.add(g._id);
                    merged.push(g);
                }
            }
            return merged;
        }

        // Fallback to pure text filter
        return textFilteredGroups;
    }, [publicGroups, deferredSearchQuery, semanticResults, textFilteredGroups]);

    const filteredMyGroups = useMemo(() => {
        if (!myGroups) return [];
        if (!deferredSearchQuery.trim()) return myGroups;
        const q = deferredSearchQuery.toLowerCase();
        return myGroups.filter(
            (g: any) =>
                g.name.toLowerCase().includes(q) ||
                g.description.toLowerCase().includes(q)
        );
    }, [myGroups, deferredSearchQuery]);

    // Nearby groups — same city as the current user
    const nearbyGroups = useMemo(() => {
        if (!publicGroups || !myProfile?.city?.name) return [];
        const userCity = myProfile.city.name.toLowerCase();
        return publicGroups
            .filter((g) => g.city.name.toLowerCase() === userCity)
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 6);
    }, [publicGroups, myProfile]);

    const isLoading = activeTab === "discover" ? publicGroups === undefined : myGroups === undefined;
    const displayGroups = activeTab === "discover" ? filteredPublicGroups : filteredMyGroups;

    // Calculate grid columns based on container width
    const cols = containerWidth < 768 ? 1 : containerWidth < 1024 ? 2 : 3;
    const rowCount = Math.ceil(displayGroups.length / cols);

    const rowVirtualizer = useWindowVirtualizer({
        count: rowCount,
        estimateSize: () => 320, // Approximate height of a card
        scrollMargin: listOffset,
        overscan: 3,
    });

    // Auth loading
    if (isAuthLoading) {
        return (
            <div className="space-y-8 max-w-6xl mx-auto px-4">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-10 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-72 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="space-y-8 max-w-6xl mx-auto px-4 pb-12">
                    {/* Hero Section */}
                    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
                        {/* Top row — branding + actions */}
                        <div className="relative px-6 pt-8 pb-6 md:px-8 md:pt-10 md:pb-8">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                                <div className="max-w-lg space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                            <Activity className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Community Hub</span>
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                        Find Your{" "}
                                        <span className="text-primary">Community</span>
                                    </h1>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Connect with neighbors, join local groups, and make a difference in
                                        {myProfile?.city?.name ? ` ${myProfile.city.name}` : " your city"}.
                                    </p>
                                </div>

                                <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
                                    <Button
                                        onClick={() => setCreateDialogOpen(true)}
                                        className="gap-2 shadow-lg shadow-primary/20 h-10 rounded-xl font-mono text-xs uppercase"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Community
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => document.getElementById('search')?.focus()}
                                        className="gap-2 h-10 rounded-xl font-mono text-xs uppercase"
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                        Explore Groups
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Stats strip */}
                        <div className="px-6 md:px-8 pb-6 md:pb-8">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-lg font-bold text-foreground">{publicGroups?.length || 0}</span>
                                    </div>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Active Groups</p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-lg font-bold text-foreground">{nearbyGroups.length}</span>
                                    </div>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Near You</p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-lg font-bold text-foreground">{myGroups?.length || 0}</span>
                                    </div>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">My Groups</p>
                                </div>
                            </div>
                        </div>

                        {/* Map CTA strip */}
                        <div className="border-t border-border">
                            <button
                                onClick={() => router.push("/map")}
                                className="w-full flex items-center justify-between gap-4 px-6 py-4 md:px-8 hover:bg-muted/30 transition-colors group/map"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                        <MapIcon className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold font-mono uppercase tracking-tight">Live City Ledger Map</p>
                                        <p className="text-[10px] text-muted-foreground">Visualize communities & events in real-time</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/map:text-primary group-hover/map:translate-x-1 transition-all shrink-0" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs - Mobile Responsive */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
                            {[
                                { id: "discover" as Tab, label: "Discover", icon: Compass, badge: 0 },
                                { id: "my-groups" as Tab, label: "My Groups", icon: FolderOpen, badge: myGroups?.length || 0 },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                                        activeTab === tab.id
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.badge > 0 && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative flex-1 sm:max-w-xs" id="search">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={
                                    activeTab === "discover"
                                        ? "AI search: try \"hiking\", \"tech meetups\"..."
                                        : "Search your groups..."
                                }
                                className="pl-10 pr-10 h-10"
                            />
                            {activeTab === "discover" && isSemanticSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                            )}
                            {activeTab === "discover" && !isSemanticSearching && semanticResults && semanticResults.length > 0 && (
                                <Wand2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                            )}
                        </div>
                    </div>

                    {/* Nearby Communities (only if user has a city & there are matches) */}
                    {activeTab === "discover" && !searchQuery && nearbyGroups.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold font-mono uppercase tracking-tight flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    Near You in {myProfile?.city?.name}
                                </h2>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                    {nearbyGroups.length} {nearbyGroups.length === 1 ? "group" : "groups"}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {nearbyGroups.map((group: any) => (
                                    <button
                                        key={group._id}
                                        onClick={() => router.push(`/community/${group._id}`)}
                                        className="group/nearby flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all text-left cursor-pointer hover:border-primary/30"
                                    >
                                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-muted">
                                            {group.coverImageUrl ? (
                                                <img src={group.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                                    <Users className="w-4 h-4 text-primary" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-semibold truncate group-hover/nearby:text-primary transition-colors">
                                                {group.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono text-muted-foreground">{group.memberCount} members</span>
                                                <span className="text-muted-foreground/30">·</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">{group.category}</span>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover/nearby:text-primary group-hover/nearby:translate-x-0.5 transition-all shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Category Filters (Discover tab only) */}
                    {activeTab === "discover" && (
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.name}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all",
                                        selectedCategory === cat.name
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                    )}
                                >
                                    <cat.icon className="w-3.5 h-3.5" />
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* AI Search Indicator */}
                    {activeTab === "discover" && deferredSearchQuery.trim() && semanticResults && semanticResults.length > 0 && (
                        <div className="flex items-center gap-2 py-2">
                            <Badge variant="outline" className="gap-1.5 text-xs font-medium border-primary/30 bg-primary/5 text-primary">
                                <Wand2 className="w-3 h-3" />
                                AI-powered results
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                Found {semanticResults.length} semantic match{semanticResults.length !== 1 ? "es" : ""}
                            </span>
                        </div>
                    )}

                    {/* Content */}
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-72 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : displayGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                                {activeTab === "discover" ? (
                                    <Compass className="w-10 h-10 text-muted-foreground/50" />
                                ) : (
                                    <FolderOpen className="w-10 h-10 text-muted-foreground/50" />
                                )}
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">
                                {activeTab === "discover"
                                    ? deferredSearchQuery
                                        ? isSemanticSearching
                                            ? "Searching with AI..."
                                            : "No groups found"
                                        : "No groups yet"
                                    : "You haven't joined any groups"}
                            </h3>
                            <p className="text-muted-foreground max-w-sm mb-8">
                                {activeTab === "discover"
                                    ? deferredSearchQuery
                                        ? "Try a different search term — our AI searches by meaning, not just keywords."
                                        : "Be the first to create a group in your city!"
                                    : "Discover and join groups to see them here."}
                            </p>
                            <Button
                                onClick={() => {
                                    if (activeTab === "my-groups") {
                                        setActiveTab("discover");
                                    } else {
                                        setCreateDialogOpen(true);
                                    }
                                }}
                                className="gap-2"
                            >
                                {activeTab === "my-groups" ? (
                                    <>
                                        <Compass className="w-4 h-4" />
                                        Discover Groups
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Create Group
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div ref={containerRef}>
                            <div
                                ref={listRef}
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const startIndex = virtualRow.index * cols;
                                    const rowGroups = displayGroups.slice(startIndex, startIndex + cols);

                                    return (
                                        <div
                                            key={virtualRow.key}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                                            }}
                                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                        >
                                            {rowGroups.map((group) => (
                                                <GroupCard key={group._id} group={group} />
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <CreateGroupDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />
        </>
    );
}

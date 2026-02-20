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
    TrendingUp,
    Sparkles,
    ArrowRight,
    MapPin,
    Calendar,
    Map as MapIcon,
    Loader2,
    Wand2,
} from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useElementSize } from "@/hooks/use-element-size";
import dynamic from "next/dynamic";
import { GroupCard } from "./GroupCard";

const CreateGroupDialog = dynamic(() => import("./CreateGroupDialog").then(mod => mod.CreateGroupDialog), { ssr: false });

const CATEGORIES = [
    { name: "All", icon: Sparkles },
    { name: "Neighborhood", icon: Users },
    { name: "Environment", icon: TrendingUp },
    { name: "Education", icon: Compass },
    { name: "Arts & Culture", icon: Sparkles },
    { name: "Sports & Recreation", icon: Users },
    { name: "Safety & Watch", icon: Shield },
    { name: "Local Business", icon: TrendingUp },
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
            (g: any) =>
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

    // Featured groups (groups with most members)
    const featuredGroups = useMemo(() => {
        if (!publicGroups) return [];
        return [...publicGroups]
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 3);
    }, [publicGroups]);

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
                    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(120,119,198,0.15),transparent_50%)]" />

                        <div className="relative px-6 py-12 md:px-10 md:py-16">
                            <div className="max-w-2xl">
                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
                                    Find Your{" "}
                                    <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60">
                                        Community
                                    </span>
                                </h1>
                                <p className="text-lg text-muted-foreground mb-6 max-w-xl">
                                    Connect with neighbors, join local groups, and make a difference in your city.
                                    Together we build stronger communities.
                                </p>

                                <div className="flex flex-wrap gap-4">
                                    <Button
                                        size="lg"
                                        onClick={() => setCreateDialogOpen(true)}
                                        className="gap-2 shadow-lg shadow-primary/25"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Create Community
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        onClick={() => document.getElementById('search')?.focus()}
                                        className="gap-2"
                                    >
                                        <Search className="w-4 h-4" />
                                        Explore Groups
                                    </Button>
                                </div>

                                {/* Quick Stats */}
                                <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-border/50">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Users className="w-4 h-4 text-primary" />
                                        <span>{publicGroups?.length || 0} Active Groups</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="w-4 h-4 text-primary" />
                                        <span>Local Communities</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        <span>New Groups Every Week</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Community Map CTA */}
                        <div className="mt-8 pt-8 border-t border-border/50">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                                <div className="space-y-1 text-center sm:text-left">
                                    <h3 className="font-bold font-mono uppercase tracking-tight flex items-center justify-center sm:justify-start gap-2">
                                        <MapIcon className="w-5 h-5 text-primary" /> LIVE CITY LEDGER MAP
                                    </h3>
                                    <p className="text-xs text-muted-foreground uppercase">Visualize all local communities and active events in real-time</p>
                                </div>
                                <Button
                                    onClick={() => router.push("/map")}
                                    className="gap-2 font-mono text-xs uppercase h-10 px-6 shadow-lg shadow-primary/20"
                                >
                                    Explore Live Map <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
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

                    {/* Featured Section (Discover only) */}
                    {activeTab === "discover" && !searchQuery && featuredGroups.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    Trending Communities
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {featuredGroups.map((group: any) => (
                                    <div
                                        key={group._id}
                                        onClick={() => router.push(`/community/${group._id}`)}
                                        className="group p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all cursor-pointer hover:shadow-lg"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Users className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                                                    {group.name}
                                                </h3>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {group.memberCount} members
                                                </p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
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
                                            {rowGroups.map((group: any) => (
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

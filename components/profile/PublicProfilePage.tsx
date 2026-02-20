"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    MapPin,
    Calendar,
    Users,
    Shield,
    Camera,
    Vote,
    Zap,
    Lock,
    User as UserIcon,
    ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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

export function PublicProfilePage({ paramsPromise }: { paramsPromise: Promise<{ userId: string }> }) {
    const { userId } = use(paramsPromise);
    const router = useRouter();
    const profile = useQuery(api.users.getUserProfileWithStats, { userId });

    if (profile === undefined) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto p-6">
                <div className="flex items-start gap-6">
                    <Skeleton className="w-24 h-24 rounded-full" />
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-8 w-52" />
                        <Skeleton className="h-4 w-36" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="md:col-span-2 h-48 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                </div>
            </div>
        );
    }

    if (profile === null) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold font-mono uppercase">User Not Found</h2>
                <p className="text-sm text-muted-foreground">This profile doesn't exist.</p>
                <Button variant="outline" onClick={() => router.back()} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </Button>
            </div>
        );
    }

    const isPublic = profile.isPublic;
    const isOwn = profile.isOwn;
    const showDetails = isPublic || isOwn;

    const cityDisplay = profile.city
        ? `${profile.city.name}${profile.city.state ? `, ${profile.city.state}` : ""}, ${profile.city.country}`
        : null;

    const initials = profile.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-6">
            {/* Back button */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono uppercase"
            >
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start gap-6 pb-6 border-b border-border">
                <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                    {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
                    <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{profile.name}</h1>
                    {showDetails && cityDisplay && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <MapPin className="w-4 h-4" />
                            <span>{cityDisplay}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={cn(
                            "text-[10px] font-mono uppercase",
                            isPublic ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-muted-foreground"
                        )}>
                            {isPublic ? "Public Profile" : "Private Profile"}
                        </Badge>
                        {isOwn && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5"
                                onClick={() => router.push("/profile")}
                            >
                                Edit Profile
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Private profile notice */}
            {!showDetails && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
                        <Lock className="w-12 h-12 text-muted-foreground/20" />
                        <h3 className="font-bold font-mono uppercase">Private Profile</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-sm">
                            This user has set their profile to private. Only their name and avatar are visible.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Full profile content — only if public or own */}
            {showDetails && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Main */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* About */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">About</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {profile.bio ? (
                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No bio provided.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Civic Impact — Real Data */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Civic Impact</CardTitle>
                                <CardDescription>Contributions to the community</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: "Groups", value: profile.stats.groupsJoined, icon: <Users className="w-4 h-4" /> },
                                        { label: "Events", value: profile.stats.eventsAttended, icon: <Calendar className="w-4 h-4" /> },
                                        { label: "Votes", value: profile.stats.votesCast, icon: <Vote className="w-4 h-4" /> },
                                        { label: "Proposals", value: profile.stats.proposalsMade, icon: <Shield className="w-4 h-4" /> },
                                        { label: "Photos", value: profile.stats.photosUploaded, icon: <Camera className="w-4 h-4" /> },
                                    ].map((s) => (
                                        <div key={s.label} className="p-3 bg-muted/50 rounded-lg text-center space-y-1">
                                            <div className="flex items-center justify-center text-primary">{s.icon}</div>
                                            <div className="text-2xl font-bold text-foreground">{s.value}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-mono">{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Groups */}
                        {profile.groups && profile.groups.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Communities</CardTitle>
                                    <CardDescription>{profile.stats.groupsJoined} groups joined</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {profile.groups.map((group: any) => (
                                            <button
                                                key={group._id}
                                                onClick={() => router.push(`/community/${group._id}`)}
                                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left group"
                                            >
                                                <span className="text-lg shrink-0">{CATEGORY_EMOJI[group.category] || "📌"}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{group.name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-mono uppercase">{group.category}</p>
                                                </div>
                                                {(group.role === "founder" || group.role === "manager") && (
                                                    <Badge variant="outline" className="text-[9px] font-mono uppercase shrink-0">
                                                        {group.role}
                                                    </Badge>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right: Sidebar */}
                    <div className="space-y-6">
                        {/* Interests */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Interests</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {profile.interests.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {profile.interests.map((interest: string) => (
                                            <Badge key={interest} variant="secondary" className="text-xs">
                                                {interest}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No interests listed.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Community Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Community</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Calendar className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Member since</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(profile.memberSince).toLocaleDateString("en-US", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                </div>
                                {profile.stats.eventsCreated > 0 && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Zap className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Events organized</p>
                                            <p className="text-xs text-muted-foreground">{profile.stats.eventsCreated} events</p>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-3 border-t border-border">
                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                        <span className={cn(
                                            "w-2 h-2 rounded-full",
                                            isPublic ? "bg-emerald-500" : "bg-muted-foreground"
                                        )} />
                                        Profile is {isPublic ? "public" : "private"} within CityHub
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}

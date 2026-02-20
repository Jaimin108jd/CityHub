"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MapPin,
    Calendar,
    Edit,
    User as UserIcon,
    Users,
    Shield,
    Camera,
    Vote,
    Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { EditProfileDialog } from "./EditProfileDialog";
import { Id } from "@/convex/_generated/dataModel";
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

export default function ProfilePageContent() {
    const router = useRouter();
    const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    // Get auth user's userId first
    const myProfile = useQuery(
        api.users.getMyProfile,
        isAuthenticated ? {} : "skip"
    );

    // Fetch full profile with real stats
    const profile = useQuery(
        api.users.getUserProfileWithStats,
        myProfile?.userId ? { userId: myProfile.userId } : "skip"
    );

    // Fast redirect when auth state resolves to logged-out
    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.replace("/auth/login");
        }
    }, [isAuthLoading, isAuthenticated, router]);

    // Auth loading
    if (isAuthLoading || (!isAuthenticated && myProfile === undefined)) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-start gap-6">
                    <Skeleton className="w-28 h-28 rounded-full" />
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                        <Skeleton className="h-40 w-full rounded-lg" />
                        <Skeleton className="h-48 w-full rounded-lg" />
                    </div>
                    <div className="space-y-4">
                        <Skeleton className="h-40 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    // Profile loading
    if (profile === undefined) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-start gap-6">
                    <Skeleton className="w-28 h-28 rounded-full" />
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                </div>
            </div>
        );
    }

    if (myProfile === null || profile === null) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold">Profile not found</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    Please complete your registration to access your profile.
                </p>
                <Button onClick={() => router.push("/onboarding")}>
                    Complete Registration
                </Button>
            </div>
        );
    }

    const cityDisplay = `${profile.city.name}${profile.city.state ? `, ${profile.city.state}` : ""}, ${profile.city.country}`;

    return (
        <>
            <div className="space-y-8 max-w-5xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start gap-6 pb-6 border-b border-border">
                    <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
                        {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
                        <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                            {profile.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                                {profile.name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-sm">{cityDisplay}</span>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditDialogOpen(true)}
                            className="gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            Edit Profile
                        </Button>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* About Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>About</CardTitle>
                                <CardDescription>
                                    Personal bio and background
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {profile.bio ? (
                                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                                        {profile.bio}
                                    </p>
                                ) : (
                                    <p className="text-muted-foreground italic">
                                        No bio provided yet. Click &quot;Edit Profile&quot; to
                                        add one.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Civic Impact — Real Data */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Civic Impact</CardTitle>
                                <CardDescription>
                                    Your contributions to the community
                                </CardDescription>
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
                                        <div key={s.label} className="p-4 bg-muted/50 rounded-lg text-center space-y-1">
                                            <div className="flex items-center justify-center text-primary">{s.icon}</div>
                                            <div className="text-2xl font-bold text-primary">{s.value}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-mono">{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Communities */}
                        {profile.groups && profile.groups.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>My Communities</CardTitle>
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

                    {/* Right Column - Sidebar */}
                    <div className="space-y-6">
                        {/* Interests */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Interests</CardTitle>
                                <CardDescription>
                                    What you care about
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {profile.interests.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {profile.interests.map((interest: string) => (
                                            <Badge
                                                key={interest}
                                                variant="secondary"
                                                className="text-xs"
                                            >
                                                {interest}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                        No interests added yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Community Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Community</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Calendar className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            Member since
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(profile.memberSince).toLocaleDateString("en-US", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                </div>
                                {profile.stats.eventsCreated > 0 && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Zap className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Events organized</p>
                                            <p className="text-sm text-muted-foreground">{profile.stats.eventsCreated} events</p>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-border">
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <p className="flex items-center gap-2">
                                            <span
                                                className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    profile.isPublic
                                                        ? "bg-green-500"
                                                        : "bg-muted-foreground"
                                                )}
                                            />
                                            Profile is {profile.isPublic ? "public" : "private"}{" "}
                                            within CityHub
                                        </p>
                                        <p className="text-xs text-muted-foreground/70">
                                            Not indexed by search engines
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Edit Profile Dialog */}
            <EditProfileDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                currentProfile={{
                    name: profile.name,
                    city: profile.city,
                    bio: profile.bio,
                    interests: profile.interests,
                    imageUrl: profile.imageUrl,
                    isPublic: profile.isPublic ?? true,
                }}
                currentAvatarUrl={profile.avatarUrl || null}
            />
        </>
    );
}

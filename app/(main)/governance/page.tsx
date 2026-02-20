"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowRight, LayoutDashboard } from "lucide-react";

export default function GlobalGovernancePage() {
    const router = useRouter();
    const myGroups = useQuery(api.groups.getMyGroups);

    // Filter for groups where I am a manager or founder
    const managedGroups = (myGroups?.filter(g => g && (g.myRole === "manager" || g.myRole === "founder")) || []) as any[];

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 rounded-full">
                    <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Governance</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage all your communities from one place.
                    </p>
                </div>
            </div>

            {myGroups === undefined ? (
                <div className="text-center py-12 text-muted-foreground">Loading your groups...</div>
            ) : managedGroups.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">No Communities to Manage</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                            You are not a manager or founder of any groups yet.
                            Create a group or get promoted to access governance tools.
                        </p>
                        <Button className="mt-6" onClick={() => router.push("/community/create")}>
                            Create a Community
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {managedGroups.map((group) => (
                        <Card key={group._id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                                <Avatar className="w-12 h-12 border border-border">
                                    {group.coverImageUrl && <AvatarImage src={group.coverImageUrl} />}
                                    <AvatarFallback>{group.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <CardTitle className="text-base font-semibold leading-none">
                                        {group.name}
                                    </CardTitle>
                                    <CardDescription className="line-clamp-1">
                                        {group.description}
                                    </CardDescription>
                                    <div className="flex items-center gap-2 pt-1">
                                        <Badge variant="secondary" className="text-[10px] h-5">
                                            {group.myRole === "founder" ? "Founder" : "Manager"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">• {group.memberCount} Members</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full justify-between group"
                                    variant="outline"
                                    onClick={() => router.push(`/community/${group._id}/governance`)}
                                >
                                    <span>Open Dashboard</span>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

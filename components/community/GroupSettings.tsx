import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Shield, Eye, Lock, Globe, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export function GroupSettings({ groupId }: { groupId: Id<"groups"> }) {
    const group = useQuery(api.groups.getGroup, { groupId });
    const updateGroup = useMutation(api.groups.updateGroup);

    const membership = useQuery(api.groups.getMyJoinRequestStatus, { groupId });

    if (!group) return null;

    const isFounder = membership?.role === "founder";

    const handleTransparencyChange = async (mode: "private" | "public_members" | "public_all") => {
        try {
            await updateGroup({
                groupId,
                transparencyMode: mode,
            });
            toast.success("Transparency mode updated");
        } catch (e: any) {
            toast.error(e.message || "Failed to update transparency mode");
        }
    };

    const handleFoundersRulesChange = async (checked: boolean) => {
        try {
            await updateGroup({
                groupId,
                foundersOnlyRules: checked,
            });
            toast.success("Constitutional rules setting updated");
        } catch (e: any) {
            toast.error(e.message || "Failed to update setting");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" /> Governance Settings
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Configure transparency and core rules for your community.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Transparency Mode */}
                <Card className="border-border bg-card shadow-sm border-t-2 border-t-blue-500 overflow-hidden">
                    <div className="bg-muted/30 p-4 border-b border-border flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                            <Eye className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm tracking-tight">Transparency Mode</h3>
                            <p className="text-xs text-muted-foreground">Who can view governance logs, proposals, and health metrics.</p>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                            {[
                                {
                                    id: "private",
                                    label: "Private",
                                    desc: "Only managers can view governance data.",
                                    icon: Lock,
                                },
                                {
                                    id: "public_members",
                                    label: "Members Only",
                                    desc: "Any approved member can view governance data.",
                                    icon: Shield,
                                },
                                {
                                    id: "public_all",
                                    label: "Public",
                                    desc: "Anyone on the internet can view governance data.",
                                    icon: Globe,
                                },
                            ].map((mode) => (
                                <label
                                    key={mode.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/10 transition-colors",
                                        group.transparencyMode === mode.id && "bg-blue-500/5 hover:bg-blue-500/10"
                                    )}
                                >
                                    <div className="pt-0.5">
                                        <input
                                            type="radio"
                                            name="transparencyMode"
                                            value={mode.id}
                                            checked={group.transparencyMode === mode.id}
                                            onChange={() => handleTransparencyChange(mode.id as any)}
                                            disabled={group.foundersOnlyRules && !isFounder}
                                            className="w-4 h-4 text-blue-500 border-border focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <mode.icon className={cn(
                                                "w-4 h-4",
                                                group.transparencyMode === mode.id ? "text-blue-500" : "text-muted-foreground"
                                            )} />
                                            <p className={cn(
                                                "text-sm font-semibold",
                                                group.transparencyMode === mode.id ? "text-foreground" : "text-muted-foreground"
                                            )}>{mode.label}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{mode.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Constitutional Rules */}
                <Card className="border-border bg-card shadow-sm border-t-2 border-t-amber-500 overflow-hidden">
                    <div className="bg-muted/30 p-4 border-b border-border flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-sm tracking-tight">Constitutional Level Rules</h3>
                            <p className="text-xs text-muted-foreground">Restrict core setting changes to founders only.</p>
                        </div>
                        <Switch
                            checked={group.foundersOnlyRules ?? false}
                            onCheckedChange={handleFoundersRulesChange}
                            disabled={!isFounder}
                            className={cn(
                                "data-[state=checked]:bg-amber-500",
                                !group.foundersOnlyRules && "bg-muted-foreground/30"
                            )}
                        />
                    </div>
                    <CardContent className="p-4 bg-background">
                        <div className="flex gap-3 text-xs text-muted-foreground">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                            <div className="space-y-1">
                                <p>When enabled, only Founders can modify:</p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                    <li>Transparency Mode</li>
                                    <li>This toggle itself</li>
                                </ul>
                                {!isFounder && group.foundersOnlyRules && (
                                    <p className="text-amber-500 font-medium mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        You cannot change this setting because you are not a founder.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Anti-centralization Info Banner */}
                <Card className="border border-red-500/20 bg-red-500/5 shadow-sm overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h3 className="font-bold text-sm text-red-600 dark:text-red-400">Democracy by Design: Anti-Centralization Rules</h3>
                                <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
                                    By building on the platform, your community inherits CityHub&apos;s hard-coded anti-centralization protocols:
                                </p>
                                <ul className="list-disc pl-4 text-xs text-red-600/80 dark:text-red-400/80 space-y-0.5 pt-1">
                                    <li>Groups with more than 3 members <strong>must</strong> maintain a minimum of 2 active managers.</li>
                                    <li>Manager demotions or kicks that violate this rule will be automatically rejected by the network.</li>
                                    <li>New member joins cannot be approved if the group is currently violating the minimum manager rule.</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

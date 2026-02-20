import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
} from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Shield, User, MapPin, Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UserProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        userId: string;
        name: string;
        avatarUrl?: string;
        role?: "founder" | "manager" | "member";
        joinedAt?: number;
        bio?: string;
        city?: string;
    };
}

const ROLE_CONFIG = {
    founder: { label: "Founder", icon: Crown, color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25" },
    manager: { label: "Manager", icon: Shield, color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/25" },
    member: { label: "Member", icon: User, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
} as const;

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

export function UserProfileDrawer({ isOpen, onClose, user }: UserProfileDrawerProps) {
    const r = user.role ? ROLE_CONFIG[user.role] : ROLE_CONFIG.member;
    const bannerGradient = getBannerColor(user.name);

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent className="max-h-[85dvh]">
                <div className="mx-auto w-full max-w-sm overflow-hidden">
                    {/* ── Banner ── */}
                    <div className={cn("h-24 bg-linear-to-r relative", bannerGradient)}>
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ── Avatar (overlaps banner) ── */}
                    <div className="px-5 relative">
                        <div className="-mt-12 flex items-end justify-between">
                            <div className="relative">
                                <div className="size-22 rounded-full bg-background p-[5px]">
                                    <Avatar className="w-full h-full">
                                        <AvatarImage src={user.avatarUrl} />
                                        <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">
                                            {user.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                {/* Status dot */}
                                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-background bg-emerald-500" />
                            </div>

                            {user.role && user.role !== "member" && (
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md border mb-1",
                                    r.bg, r.color, r.border
                                )}>
                                    <r.icon className="w-3.5 h-3.5" />
                                    {r.label}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Info body ── */}
                    <DrawerHeader className="px-5 pt-3 pb-0">
                        <DrawerTitle className="text-xl font-bold text-foreground text-left">{user.name}</DrawerTitle>
                        <DrawerDescription className="text-sm text-muted-foreground text-left">
                            {user.name.toLowerCase().replace(/\s+/g, "")}
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="mx-4 my-3 p-4 rounded-lg bg-muted/40 border border-border/50 space-y-3">
                        {user.bio && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">About Me</p>
                                <p className="text-sm text-foreground/85 leading-relaxed">{user.bio}</p>
                            </div>
                        )}

                        {(user.bio && (user.city || user.joinedAt)) && <div className="h-px bg-border/60" />}

                        <div className="space-y-2">
                            {user.city && (
                                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                    <MapPin className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                                    <span>{user.city}</span>
                                </div>
                            )}
                            {user.joinedAt && (
                                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                    <Calendar className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                                    <span>Joined {new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-border/60" />

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Role</p>
                            <span className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold uppercase rounded-md border",
                                r.bg, r.color, r.border
                            )}>
                                <r.icon className="w-3.5 h-3.5" />
                                {r.label}
                            </span>
                        </div>
                    </div>

                    <DrawerFooter className="pt-0 pb-6 px-5">
                        <Button variant="outline" onClick={onClose} className="w-full">
                            Close
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

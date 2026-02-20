"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bell,
    Check,
    CheckCheck,
    Shield,
    MessageSquare,
    Vote,
    CalendarDays,
    Wallet,
    Users,
    Image,
    BarChart3,
    X,
    Settings,
    Filter,
    BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { NotificationSettings } from "./NotificationSettings";

// ─── Icon Config ────────────────────────────────────────────────────
const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
    governance: { icon: Shield, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
    message: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
    vote: { icon: Vote, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
    event: { icon: CalendarDays, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    payment: { icon: Wallet, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
    member: { icon: Users, color: "text-sky-600", bg: "bg-sky-100 dark:bg-sky-900/30" },
    photo: { icon: Image, color: "text-pink-600", bg: "bg-pink-100 dark:bg-pink-900/30" },
    poll: { icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
};

const LAYER_INDICATOR: Record<string, { dot: string; label: string }> = {
    critical: { dot: "bg-red-500", label: "Critical" },
    important: { dot: "bg-yellow-500", label: "Important" },
    passive: { dot: "bg-gray-400", label: "Activity" },
};

// ─── Notification Bell Button ───────────────────────────────────────
export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;

    // ── Realtime web notification watcher (always mounted) ──
    const criticalNotifs = useQuery(api.notifications.getRecentCritical) ?? [];
    const prevCriticalIdsRef = useRef<Set<string>>(new Set());
    const isInitialRef = useRef(true);

    useEffect(() => {
        if (!criticalNotifs.length && isInitialRef.current) {
            isInitialRef.current = false;
            return;
        }

        const currentIds = new Set(criticalNotifs.map((n) => n._id));

        if (isInitialRef.current) {
            // First load — just record existing IDs, don't fire
            prevCriticalIdsRef.current = currentIds;
            isInitialRef.current = false;
            return;
        }

        // Find truly new critical notifications
        const newOnes = criticalNotifs.filter(
            (n) => !prevCriticalIdsRef.current.has(n._id)
        );

        for (const n of newOnes) {
            triggerWebNotification(n.title, n.message, n.data);
        }

        prevCriticalIdsRef.current = currentIds;
    }, [criticalNotifs]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground relative"
                    >
                        <Bell className="w-4 h-4" />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-2 ring-background">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                        <span className="sr-only">
                            Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ""}
                        </span>
                    </Button>
                }
            />
            <SheetContent side="right" showCloseButton={false} className="p-0 w-full sm:w-110 sm:max-w-110 flex flex-col">
                <NotificationTray onClose={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    );
}

// ─── Notification Tray ──────────────────────────────────────────────
function NotificationTray({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const notifications = useQuery(api.notifications.getNotifications, { limit: 50 }) ?? [];
    const markAsRead = useMutation(api.notifications.markAsRead);
    const markAllAsRead = useMutation(api.notifications.markAllAsRead);

    const [filter, setFilter] = useState<"all" | "critical" | "important" | "passive">("all");
    const [groupFilter, setGroupFilter] = useState<string | null>(null);

    const filtered = notifications.filter((n) => {
        const layer = n.layer ?? "passive";
        if (filter !== "all" && layer !== filter) return false;
        if (groupFilter && n.groupId !== groupFilter) return false;
        return true;
    });

    // Get unique groups for filter
    const groups = Array.from(
        new Map(
            notifications
                .filter((n) => n.groupId && n.groupName)
                .map((n) => [n.groupId, n.groupName!])
        )
    );

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const handleClick = useCallback(
        async (notification: (typeof notifications)[0]) => {
            if (!notification.isRead) {
                await markAsRead({ notificationId: notification._id as Id<"notifications"> });
            }
            // Navigate based on type
            const data = notification.data as any;
            if (data?.channelId && data?.groupId) {
                router.push(`/community/${data.groupId}?channel=${data.channelId}${data.messageId ? `&message=${data.messageId}` : ""}`);
            } else if (data?.groupId) {
                router.push(`/community/${data.groupId}`);
            } else if (data?.eventId) {
                router.push(`/community/${data.groupId}?tab=events&event=${data.eventId}`);
            }
            onClose();
        },
        [markAsRead, router, onClose]
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-card/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-semibold">Notifications</h2>
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] rounded-full">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <NotificationSettings />
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                                onClick={() => markAllAsRead({})}
                            >
                                <CheckCheck className="w-3 h-3 mr-1" />
                                Mark all read
                            </Button>
                        )}
                    </div>
                </div>

                {/* Layer Filters */}
                <div className="flex gap-1 mt-2">
                    {(["all", "critical", "important", "passive"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                                filter === f
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            {f === "all" ? "All" : f === "critical" ? "🔴 Critical" : f === "important" ? "🟡 Updates" : "⚪ Activity"}
                        </button>
                    ))}
                </div>

                {/* Group Filter */}
                {groups.length > 1 && (
                    <div className="flex gap-1 mt-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setGroupFilter(null)}
                            className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors",
                                !groupFilter ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            All Groups
                        </button>
                        {groups.map(([id, name]) => (
                            <button
                                key={id as string}
                                onClick={() => setGroupFilter(id as string)}
                                className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors",
                                    groupFilter === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {name as string}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <BellOff className="w-8 h-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {filter !== "all" ? "Try a different filter" : "You're all caught up!"}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filtered.map((notification) => (
                            <NotificationItem
                                key={notification._id}
                                notification={notification}
                                onClick={() => handleClick(notification)}
                                onMarkRead={() =>
                                    markAsRead({ notificationId: notification._id as Id<"notifications"> })
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Single Notification Item ───────────────────────────────────────
function NotificationItem({
    notification,
    onClick,
    onMarkRead,
}: {
    notification: {
        _id: string;
        type: string;
        layer?: string | null;
        title?: string | null;
        message: string;
        icon?: string | null;
        groupName?: string | null;
        isRead: boolean;
        createdAt: number;
        data?: any;
    };
    onClick: () => void;
    onMarkRead: () => void;
}) {
    const iconConfig = NOTIFICATION_ICONS[notification.icon ?? "message"] ?? NOTIFICATION_ICONS.message;
    const layerConfig = LAYER_INDICATOR[notification.layer ?? "passive"] ?? LAYER_INDICATOR.passive;
    const Icon = iconConfig.icon;
    const displayTitle = notification.title ?? notification.type ?? "Notification";

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
            className={cn(
                "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 group cursor-pointer",
                !notification.isRead && "bg-primary/5"
            )}
        >
            {/* Icon */}
            <div className={cn("mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconConfig.bg)}>
                <Icon className={cn("w-4 h-4", iconConfig.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    {!notification.isRead && (
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", layerConfig.dot)} />
                    )}
                    <span className={cn("text-xs font-semibold truncate", !notification.isRead ? "text-foreground" : "text-muted-foreground")}>
                        {displayTitle}
                    </span>
                </div>
                <p className={cn("text-[11px] mt-0.5 line-clamp-2", !notification.isRead ? "text-foreground/80" : "text-muted-foreground")}>
                    {notification.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    {notification.groupName && (
                        <span className="text-[10px] text-muted-foreground/70 truncate max-w-30">
                            {notification.groupName}
                        </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50">
                        {formatTimeAgo(notification.createdAt)}
                    </span>
                </div>
            </div>

            {/* Mark as read button */}
            {!notification.isRead && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead();
                    }}
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                    title="Mark as read"
                >
                    <Check className="w-3 h-3 text-muted-foreground" />
                </button>
            )}
        </div>
    );
}

// ─── Web Notification Helper ────────────────────────────────────────
function triggerWebNotification(title: string, body: string, data?: any) {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // Don't fire if tab is focused
    if (document.hasFocus()) return;

    try {
        const notif = new Notification(title, {
            body,
            icon: "/icons/cityhub-192.png",
            badge: "/icons/cityhub-badge.png",
            tag: data?.groupId ?? "cityhub",
        } as NotificationOptions);

        notif.onclick = () => {
            window.focus();
            notif.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notif.close(), 5000);
    } catch {
        // Silently fail if notification API is not available
    }
}

// ─── Time Formatter ─────────────────────────────────────────────────
function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return new Date(timestamp).toLocaleDateString();
}

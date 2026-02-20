"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    MapPin,
    Users,
    ArrowLeft,
    Calendar,
    Camera,
    Clock,
    X,
    Check,
    Lock,
    Globe,
    DollarSign,
    BarChart3,
    Loader2,
    ImagePlus,
    ShieldCheck,
    AlertCircle,
    Megaphone,
    CheckCircle,
    XCircle,
    ExternalLink,
    Plane,
    TrendingUp,
    Wallet,
    Ticket,
    PieChart,
    CreditCard,
    UserCheck,
    Eye,
} from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export default function EventDetailPage({
    groupId,
    eventId,
}: {
    groupId: Id<"groups">;
    eventId: Id<"events">;
}) {
    const router = useRouter();
    const { isAuthenticated } = useConvexAuth();

    // State
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [showAllAttendees, setShowAllAttendees] = useState(false);

    // Queries
    const event = useQuery(api.events.getEventById, isAuthenticated ? { eventId } : "skip");
    const myStatus = useQuery(api.groups.getMyJoinRequestStatus, isAuthenticated ? { groupId } : "skip");
    const eventPhotos = useQuery(api.events.getEventPhotos, isAuthenticated ? { eventId } : "skip");
    const eventAnalytics = useQuery(
        api.events.getEventAnalytics,
        isAuthenticated && myStatus?.status === "member" && (myStatus.role === "manager" || myStatus.role === "founder")
            ? { eventId }
            : "skip"
    );

    // Mutations & Actions
    const attendEvent = useMutation(api.events.attendEvent);
    const cancelAttendance = useMutation(api.events.cancelAttendance);
    const createOrder = useAction(api.payments.createOrder);
    const verifyPayment = useAction(api.payments.verifyPayment);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const updateEventStatus = useMutation(api.events.updateEventStatus);
    const uploadEventPhoto = useMutation(api.events.uploadEventPhoto);
    const generateUploadUrl = useMutation(api.events.generateUploadUrl);
    const uploadEventCoverImage = useMutation(api.events.uploadEventCoverImage);
    const approveEventPhoto = useMutation(api.events.approveEventPhoto);
    const rejectEventPhoto = useMutation(api.events.rejectEventPhoto);

    // Derived
    const isManager = myStatus?.status === "member" && (myStatus.role === "manager" || myStatus.role === "founder");

    // Computed status
    const eventStatus = useMemo(() => {
        if (!event) return "upcoming";
        return event.computedStatus as "upcoming" | "ongoing" | "completed" | "cancelled";
    }, [event]);

    const isAttendee = useMemo(() => {
        if (!event || !myStatus?.userId) return false;
        return event.attendees.includes(myStatus.userId);
    }, [event, myStatus]);

    // Photo upload window
    const photoMeta = useMemo(() => {
        if (!event) return { canUploadMemory: false, canUploadLive: false, canUploadPromo: false, canUploadCover: false, isLateUpload: false, daysLeft: 0, isWithinWindow: false };
        const now = Date.now();
        const endTime = event.endTime || event.startTime;
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const isWithinWindow = eventStatus === "completed" && now <= endTime + SEVEN_DAYS;
        const isLateUpload = eventStatus === "completed" && now > endTime + SEVEN_DAYS;
        const daysLeft = eventStatus === "completed" ? Math.max(0, Math.ceil((endTime + SEVEN_DAYS - now) / (24 * 60 * 60 * 1000))) : 0;

        return {
            canUploadMemory: isAttendee && eventStatus === "completed",
            canUploadLive: isAttendee && eventStatus === "ongoing",
            canUploadPromo: isManager && eventStatus === "upcoming",
            canUploadCover: isManager && eventStatus !== "cancelled",
            isLateUpload,
            isWithinWindow,
            daysLeft,
        };
    }, [event, eventStatus, isAttendee, isManager]);

    const pendingPhotos = useMemo(() => {
        if (!isManager || !eventPhotos) return [];
        return eventPhotos.filter((p: any) => p.needsApproval && !p.approved);
    }, [isManager, eventPhotos]);

    const approvedPhotos = useMemo(() => {
        if (!eventPhotos) return [];
        return eventPhotos.filter((p: any) => p.approved !== false);
    }, [eventPhotos]);

    // City distribution for analytics
    const cityDistribution = useMemo(() => {
        if (!event?.attendeeDetails) return [];
        const cities: Record<string, number> = {};
        event.attendeeDetails.forEach((a: any) => {
            const city = a.city || "Unknown";
            cities[city] = (cities[city] || 0) + 1;
        });
        return Object.entries(cities)
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count);
    }, [event?.attendeeDetails]);

    const displayedAttendees = useMemo(() => {
        const all = event?.attendeeDetails || [];
        return showAllAttendees ? all : all.slice(0, 8);
    }, [event?.attendeeDetails, showAllAttendees]);

    // Handlers
    const handleUpload = useCallback(async (photoType: "memory" | "live" | "promo") => {
        if (!event) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = async (e: any) => {
            const files = Array.from(e.target.files || []) as File[];
            if (!files.length) return;
            setIsUploadingPhoto(true);
            try {
                for (const file of files) {
                    if (file.size > 10 * 1024 * 1024) {
                        toast.error(`${file.name} is too large (max 10MB)`);
                        continue;
                    }
                    const uploadUrl = await generateUploadUrl();
                    const res = await fetch(uploadUrl, {
                        method: "POST",
                        headers: { "Content-Type": file.type },
                        body: file,
                    });
                    const { storageId } = await res.json();
                    await uploadEventPhoto({ eventId, storageId, type: photoType });
                }
                const label = photoType === "live" ? "live photo" : photoType === "promo" ? "promo" : "memory photo";
                toast.success(`${files.length} ${label}${files.length > 1 ? "s" : ""} uploaded!`);
            } catch (err: any) {
                toast.error(err.message || "Upload failed");
            } finally {
                setIsUploadingPhoto(false);
            }
        };
        input.click();
    }, [event, eventId, generateUploadUrl, uploadEventPhoto]);

    const handleCoverUpload = useCallback(async () => {
        if (!event) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { toast.error("File is too large (max 10MB)"); return; }
            setIsUploadingPhoto(true);
            try {
                const uploadUrl = await generateUploadUrl();
                const res = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": file.type },
                    body: file,
                });
                const { storageId } = await res.json();
                await uploadEventCoverImage({ eventId, storageId });
                toast.success("Cover image updated!");
            } catch (err: any) {
                toast.error(err.message || "Cover upload failed");
            } finally {
                setIsUploadingPhoto(false);
            }
        };
        input.click();
    }, [event, eventId, generateUploadUrl, uploadEventCoverImage]);

    const handleAttend = useCallback(async () => {
        if (!event) return;

        // ── Paid event → Razorpay flow ──
        if (event.isPaid && event.price) {
            setIsProcessingPayment(true);
            try {
                const order = await createOrder({
                    amount: event.price,
                    currency: "INR",
                    receipt: `event_${eventId}`,
                    notes: { eventId, userId: myStatus?.userId ?? "" },
                });

                // Load Razorpay SDK (once)
                await new Promise<void>((resolve, reject) => {
                    if ((window as any).Razorpay) return resolve();
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error("Failed to load payment SDK"));
                    document.body.appendChild(script);
                });

                const rzp = new (window as any).Razorpay({
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: order.amount,
                    currency: order.currency,
                    name: "CityHub",
                    description: `Ticket for ${event.title}`,
                    order_id: order.id,
                    handler: async (response: any) => {
                        try {
                            await verifyPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                type: "event",
                                targetId: eventId,
                                amount: event.price!,
                                userId: myStatus?.userId ?? "",
                            });
                            toast.success("Ticket purchased — you're in!");
                        } catch (e: any) {
                            toast.error(e.message || "Payment verification failed");
                        } finally {
                            setIsProcessingPayment(false);
                        }
                    },
                    modal: {
                        ondismiss: () => setIsProcessingPayment(false),
                    },
                    prefill: { name: "User", email: "" },
                    theme: { color: "#10b981" },
                });
                rzp.open();
            } catch (err: any) {
                toast.error(err.message || "Failed to initiate payment");
                setIsProcessingPayment(false);
            }
            return;
        }

        // ── Free event → direct attend ──
        try {
            await attendEvent({ eventId });
            toast.success("You're attending this event!");
        } catch (err: any) {
            toast.error(err.message || "Failed to attend");
        }
    }, [event, eventId, attendEvent, createOrder, verifyPayment, myStatus?.userId]);

    const handleCancelAttendance = useCallback(async () => {
        try {
            await cancelAttendance({ eventId });
            toast.success("Attendance cancelled");
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel");
        }
    }, [eventId, cancelAttendance]);

    // Status config
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
        upcoming: { label: "Upcoming", variant: "default" },
        ongoing: { label: "Live Now", variant: "default", className: "bg-amber-500 hover:bg-amber-500/90 text-white border-amber-500 animate-pulse" },
        completed: { label: "Completed", variant: "secondary" },
        cancelled: { label: "Cancelled", variant: "destructive", className: "bg-red-500/10 text-red-500 border-red-500/30" },
    };

    // Loading skeleton
    if (!event) {
        return (
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-56 w-full rounded-2xl" />
                <div className="space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-28 rounded-full" />
                        <Skeleton className="h-6 w-28 rounded-full" />
                        <Skeleton className="h-6 w-28 rounded-full" />
                    </div>
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const sc = statusConfig[eventStatus];
    const isDone = eventStatus === "completed" || eventStatus === "cancelled";
    const date = new Date(event.startTime);
    const isFull = event.capacity && event.attendees.length >= event.capacity;
    const fillRate = event.capacity ? Math.round((event.attendees.length / event.capacity) * 100) : null;

    return (
        <div className="bg-background min-h-dvh lg:min-h-screen pb-20">
            {/* ═══ FULL-BLEED HEADER ═══ */}
            <div className="relative bg-card border-b border-border shrink-0">
                <div className="h-40 sm:h-56 lg:h-72 w-full overflow-hidden relative bg-muted group/cover">
                    {event.coverImageUrl ? (
                        <img
                            src={event.coverImageUrl}
                            alt="Event cover"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-105"
                            loading="eager"
                        />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
                            <Calendar className="w-16 h-16 opacity-20 text-muted-foreground" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />

                    {/* Top bar over cover */}
                    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 sm:p-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 hover:text-white gap-2"
                            onClick={() => router.push(`/community/${groupId}?tab=events`)}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs">Back</span>
                        </Button>
                        <div className="flex items-center gap-2">
                            {/* Travel Event Badge */}
                            {event.isTravelEvent && (
                                <Badge className="text-[9px] font-mono uppercase gap-1 bg-violet-500/90 text-white border-none backdrop-blur-sm">
                                    <Plane className="w-3 h-3" /> Travel Event
                                </Badge>
                            )}
                            {/* Status overlay for ongoing */}
                            {eventStatus === "ongoing" && (
                                <Badge className="text-[9px] font-mono uppercase gap-1 bg-amber-500 text-white border-none backdrop-blur-sm animate-pulse">
                                    <Eye className="w-3 h-3" /> Live Now
                                </Badge>
                            )}
                            {photoMeta.canUploadCover && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-3 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 hover:text-white gap-2"
                                    disabled={isUploadingPhoto}
                                    onClick={handleCoverUpload}
                                >
                                    {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                                    <span className="hidden sm:inline text-xs">
                                        {isUploadingPhoto ? "Uploading..." : event.coverImageUrl ? "Change Cover" : "Add Cover"}
                                    </span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Event Info overlapping cover */}
                <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end -mt-10 sm:-mt-16 pb-4 sm:pb-5 relative z-10">
                        {/* Event icon */}
                        <div className="shrink-0">
                            <div className="w-16 h-16 sm:w-24 sm:h-24 p-1 bg-card border-2 border-border rounded-lg shadow-lg">
                                <div className="w-full h-full bg-muted flex flex-col items-center justify-center rounded-md">
                                    <span className="text-[10px] sm:text-xs font-mono uppercase text-muted-foreground">
                                        {date.toLocaleDateString("en-IN", { month: "short" })}
                                    </span>
                                    <span className="text-xl sm:text-3xl font-black text-foreground leading-none">
                                        {date.getDate()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Title & meta */}
                        <div className="flex-1 min-w-0 pb-0.5">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <Badge variant={sc.variant} className={cn("text-[10px] font-mono uppercase", sc.className)}>
                                    {sc.label}
                                </Badge>
                                {event.isPaid ? (
                                    <Badge variant="outline" className="text-[10px] font-mono gap-1 text-emerald-600 border-emerald-500/30">
                                        <DollarSign className="w-3 h-3" /> ₹{event.price}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] font-mono gap-1 text-blue-600 border-blue-500/30">
                                        <Ticket className="w-3 h-3" /> Free
                                    </Badge>
                                )}
                                {event.eventType === "online" && (
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                        <Globe className="w-3 h-3" /> Online
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-lg sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground leading-tight">
                                {event.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    {event.endTime && ` – ${new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> {event.location}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> {event.attendees.length}{event.capacity ? `/${event.capacity}` : ""} {isDone ? "attended" : "going"}
                                </span>
                            </div>
                        </div>

                        {/* Action button */}
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                            {eventStatus === "cancelled" ? (
                                <Button variant="outline" disabled className="h-9 gap-2 flex-1 sm:flex-none text-red-400 font-mono text-xs uppercase">
                                    Cancelled
                                </Button>
                            ) : eventStatus === "completed" ? (
                                <Button variant="secondary" disabled className="h-9 gap-2 flex-1 sm:flex-none font-mono text-xs uppercase">
                                    Event Ended
                                </Button>
                            ) : isAttendee ? (
                                <div className="flex gap-2 flex-1 sm:flex-none">
                                    <Button variant="secondary" disabled className="h-9 gap-2 flex-1 sm:flex-none bg-emerald-500/10 text-emerald-600 border-border font-mono text-xs uppercase">
                                        <Check className="w-4 h-4" /> {event.isPaid ? "Ticket Purchased" : "Going"}
                                    </Button>
                                    {!event.isPaid && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 text-red-500 hover:text-red-500"
                                            onClick={handleCancelAttendance}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ) : isFull ? (
                                <Button variant="outline" disabled className="h-9 gap-2 flex-1 sm:flex-none font-mono text-xs uppercase">Full</Button>
                            ) : (
                                <Button
                                    className="h-9 gap-2 flex-1 sm:flex-none font-mono text-xs uppercase shadow-lg shadow-primary/20"
                                    onClick={handleAttend}
                                    disabled={isProcessingPayment}
                                >
                                    {isProcessingPayment ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                                    ) : event.isPaid ? (
                                        <><CreditCard className="w-4 h-4" /> ₹{event.price} — Buy Ticket</>
                                    ) : (
                                        <><UserCheck className="w-4 h-4" /> Attend</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ MAIN CONTENT ═══ */}
            <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 mt-6">
                {/* ── Countdown banner for upcoming events ── */}
                {eventStatus === "upcoming" && (() => {
                    const diff = event.startTime - Date.now();
                    const days = Math.floor(diff / 86400000);
                    const hours = Math.floor((diff % 86400000) / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    return (
                        <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                            <Clock className="w-5 h-5 text-primary shrink-0" />
                            <div className="flex-1">
                                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Starts in</p>
                                <p className="text-sm font-bold text-foreground font-mono">
                                    {days > 0 && `${days}d `}{hours}h {mins}m
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-foreground">{date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                        </div>
                    );
                })()}

                {/* ── Quick Info Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <Users className="w-4 h-4 text-primary" />
                            {event.capacity && <span className="text-[9px] font-mono text-muted-foreground">/ {event.capacity}</span>}
                        </div>
                        <p className="text-2xl font-black text-foreground leading-none">{event.attendees.length}</p>
                        <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">{isDone ? "Attended" : "Going"}</p>
                    </div>
                    {event.capacity && (
                        <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                            <PieChart className={cn("w-4 h-4", fillRate && fillRate >= 80 ? "text-emerald-500" : "text-primary")} />
                            <p className={cn("text-2xl font-black leading-none", fillRate && fillRate >= 80 ? "text-emerald-600" : "text-foreground")}>
                                {fillRate}%
                            </p>
                            <div className="space-y-1">
                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Fill Rate</p>
                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all", fillRate && fillRate >= 80 ? "bg-emerald-500" : fillRate && fillRate >= 50 ? "bg-amber-500" : "bg-primary")} style={{ width: `${fillRate}%` }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                        <Camera className="w-4 h-4 text-primary" />
                        <p className="text-2xl font-black text-foreground leading-none">{approvedPhotos.length}</p>
                        <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Photos</p>
                    </div>
                    <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                        {event.isPaid ? (
                            <>
                                <Wallet className="w-4 h-4 text-emerald-500" />
                                <p className="text-2xl font-black text-emerald-600 leading-none">₹{event.price}</p>
                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Ticket Price</p>
                            </>
                        ) : (
                            <>
                                <Ticket className="w-4 h-4 text-blue-500" />
                                <p className="text-2xl font-black text-blue-600 leading-none">Free</p>
                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Entry</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Location Map Link */}
                {event.eventType === "in-person" && event.locationCoords && (
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${event.locationCoords.lat},${event.locationCoords.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors group/loc"
                    >
                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate group-hover/loc:text-primary transition-colors">{event.location}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                                {event.isTravelEvent && event.groupCity
                                    ? `Travel event · Base: ${event.groupCity.name}`
                                    : "Open in Google Maps →"
                                }
                            </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    </a>
                )}

                {/* Description */}
                {event.description && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">About This Event</h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{event.description}</p>
                            {event.isPaid && event.refundPolicy && (
                                <div className="pt-3 border-t border-border">
                                    <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-mono font-bold uppercase text-amber-600 mb-0.5">Refund Policy</p>
                                            <p className="text-xs text-muted-foreground">{event.refundPolicy}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Group Link */}
                <button
                    onClick={() => router.push(`/community/${groupId}`)}
                    className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:bg-accent/50 transition-all group/link"
                >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold truncate group-hover/link:text-primary transition-colors">{event.groupName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">{event.groupCategory}</p>
                    </div>
                </button>

                {/* ── Manager Analytics ── */}
                {isManager && eventAnalytics && (
                    <div className="space-y-4 border border-border rounded-2xl p-5 bg-card">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" /> Event Analytics
                            </h3>
                            <Badge variant="outline" className="text-[9px] font-mono uppercase gap-1 rounded-full">
                                <ShieldCheck className="w-3 h-3" /> Manager
                            </Badge>
                        </div>

                        {/* Key Metrics */}
                        <div className={cn(
                            "grid gap-3",
                            event.isPaid ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
                        )}>
                            <div className="p-4 bg-muted/30 border border-border rounded-xl text-center space-y-1">
                                <Users className="w-4 h-4 text-primary mx-auto" />
                                <p className="text-2xl font-bold text-foreground">{eventAnalytics.attendeeCount}</p>
                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Attendees</p>
                            </div>
                            {eventAnalytics.fillRate !== null && (
                                <div className="p-4 bg-muted/30 border border-border rounded-xl text-center space-y-1">
                                    <TrendingUp className="w-4 h-4 text-primary mx-auto" />
                                    <p className={cn("text-2xl font-bold", eventAnalytics.fillRate >= 80 ? "text-emerald-600" : eventAnalytics.fillRate >= 50 ? "text-amber-600" : "text-foreground")}>
                                        {eventAnalytics.fillRate}%
                                    </p>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Fill Rate</p>
                                </div>
                            )}
                            {!event.isPaid && (
                                <div className="p-4 bg-muted/30 border border-border rounded-xl text-center space-y-1">
                                    <Ticket className="w-4 h-4 text-blue-600 mx-auto" />
                                    <p className="text-2xl font-bold text-blue-600">Free</p>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Entry Type</p>
                                </div>
                            )}
                            {event.isPaid && (
                                <>
                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-center space-y-1">
                                        <Wallet className="w-4 h-4 text-emerald-600 mx-auto" />
                                        <p className="text-2xl font-bold text-emerald-600">₹{eventAnalytics.revenue}</p>
                                        <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Total Revenue</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 border border-border rounded-xl text-center space-y-1">
                                        <Ticket className="w-4 h-4 text-primary mx-auto" />
                                        <p className="text-2xl font-bold text-foreground">{eventAnalytics.ticketsSold}</p>
                                        <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Tickets Sold</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Paid Event Extra Metrics */}
                        {event.isPaid && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="p-3 bg-muted/20 border border-border rounded-xl text-center space-y-0.5">
                                    <p className="text-lg font-bold text-foreground">₹{event.price}</p>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Per Ticket</p>
                                </div>
                                <div className="p-3 bg-muted/20 border border-border rounded-xl text-center space-y-0.5">
                                    <p className="text-lg font-bold text-foreground">
                                        {eventAnalytics.pendingPayments || 0}
                                    </p>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Pending Payments</p>
                                </div>
                                <div className="p-3 bg-muted/20 border border-border rounded-xl text-center space-y-0.5">
                                    <p className="text-lg font-bold text-foreground">
                                        ₹{eventAnalytics.ticketsSold > 0 ? Math.round(eventAnalytics.revenue / eventAnalytics.ticketsSold) : 0}
                                    </p>
                                    <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Avg Revenue</p>
                                </div>
                            </div>
                        )}

                        {/* City Distribution */}
                        {cityDistribution.length > 0 && (
                            <div className="border border-border rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                                        Attendee Cities
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground">
                                        {cityDistribution.length} {cityDistribution.length === 1 ? "city" : "cities"}
                                    </span>
                                </div>
                                <div className="divide-y divide-border max-h-32 overflow-y-auto">
                                    {cityDistribution.map(({ city, count }) => (
                                        <div key={city} className="flex items-center justify-between px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-xs font-medium">{city}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full"
                                                        style={{ width: `${Math.round((count / event.attendees.length) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Attendee List */}
                        {event.attendeeDetails && event.attendeeDetails.length > 0 && (
                            <div className="border border-border rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                                        Attendees ({event.attendees.length})
                                    </span>
                                    {event.attendeeDetails.length > 8 && (
                                        <button
                                            onClick={() => setShowAllAttendees(!showAllAttendees)}
                                            className="text-[10px] font-mono text-primary hover:underline"
                                        >
                                            {showAllAttendees ? "Show Less" : `View All (${event.attendeeDetails.length})`}
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                                    {displayedAttendees.map((a: any) => (
                                        <div key={a.userId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                            <ProfileAvatar
                                                userId={a.userId}
                                                name={a.name}
                                                avatarUrl={a.imageUrl}
                                                className="w-8 h-8 text-[10px]"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{a.name}</p>
                                                {a.city && (
                                                    <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                        <MapPin className="w-2.5 h-2.5" /> {a.city}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Status Controls */}
                        {eventStatus !== "cancelled" && eventStatus !== "completed" && (
                            <div className="flex gap-2 pt-2 border-t border-border">
                                {(eventStatus === "ongoing" || event.startTime < Date.now()) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs font-mono uppercase flex-1 gap-1.5 rounded-lg h-9"
                                        onClick={async () => {
                                            await updateEventStatus({ eventId, status: "completed" });
                                            toast.success("Event marked as completed");
                                        }}
                                    >
                                        <Check className="w-3.5 h-3.5" /> Mark Completed
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs font-mono uppercase gap-1.5 text-red-500 hover:text-red-500 rounded-lg h-9"
                                    onClick={async () => {
                                        await updateEventStatus({ eventId, status: "cancelled" });
                                        toast.success("Event cancelled");
                                    }}
                                >
                                    <X className="w-3.5 h-3.5" /> Cancel Event
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Attendees Section (Non-manager view) ── */}
                {!isManager && event.attendeeDetails && event.attendeeDetails.length > 0 && (
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" /> Attendees ({event.attendees.length})
                            </span>
                            {event.attendeeDetails.length > 8 && (
                                <button
                                    onClick={() => setShowAllAttendees(!showAllAttendees)}
                                    className="text-[10px] font-mono text-primary hover:underline"
                                >
                                    {showAllAttendees ? "Show Less" : `View All`}
                                </button>
                            )}
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-border">
                            {displayedAttendees.map((a: any) => (
                                <div key={a.userId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                    <ProfileAvatar
                                        userId={a.userId}
                                        name={a.name}
                                        avatarUrl={a.imageUrl}
                                        className="w-8 h-8 text-[10px]"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{a.name}</p>
                                        {a.city && (
                                            <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                <MapPin className="w-2.5 h-2.5" /> {a.city}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Pending Approval (Manager Only) ── */}
                {pendingPhotos.length > 0 && (
                    <div className="space-y-3 border border-amber-500/30 rounded-xl p-5 bg-amber-500/5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Pending Approval ({pendingPhotos.length})
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {pendingPhotos.map((photo: any) => (
                                <div key={photo._id} className="relative aspect-square rounded-lg overflow-hidden border-2 border-amber-500/40 group/pending">
                                    <img src={photo.url} alt={photo.caption || "Pending photo"} className="w-full h-full object-cover opacity-80" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover/pending:opacity-100 transition-opacity">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 w-7 p-0 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-lg"
                                            onClick={async () => {
                                                try { await approveEventPhoto({ photoId: photo._id }); toast.success("Approved"); } catch (err: any) { toast.error(err.message); }
                                            }}
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 w-7 p-0 bg-red-500/90 hover:bg-red-500 text-white rounded-lg"
                                            onClick={async () => {
                                                try { await rejectEventPhoto({ photoId: photo._id }); toast.success("Rejected"); } catch (err: any) { toast.error(err.message); }
                                            }}
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute top-1 left-1">
                                        <Badge className="text-[7px] bg-amber-500 text-white border-none px-1 py-0">PENDING</Badge>
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent p-1.5">
                                        <p className="text-[8px] text-white font-mono truncate">{photo.uploaderName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Photo Gallery ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <Camera className="w-4 h-4 text-primary" /> Event Photos {approvedPhotos.length > 0 ? `(${approvedPhotos.length})` : ""}
                        </h3>
                        <div className="flex items-center gap-2">
                            {photoMeta.canUploadMemory && photoMeta.isWithinWindow && photoMeta.daysLeft <= 3 && photoMeta.daysLeft > 0 && (
                                <span className="text-[9px] font-mono text-amber-500">{photoMeta.daysLeft}d left</span>
                            )}
                            {photoMeta.canUploadMemory && (
                                <Button
                                    variant="outline" size="sm"
                                    className="h-7 text-[10px] font-mono uppercase gap-1 rounded-lg"
                                    disabled={isUploadingPhoto}
                                    onClick={() => handleUpload("memory")}
                                >
                                    {isUploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                                    {photoMeta.isLateUpload ? "Submit for Review" : "Add Photos"}
                                </Button>
                            )}
                            {photoMeta.canUploadLive && (
                                <Button
                                    variant="outline" size="sm"
                                    className="h-7 text-[10px] font-mono uppercase gap-1 border-amber-500/40 text-amber-600 hover:text-amber-600 rounded-lg"
                                    disabled={isUploadingPhoto}
                                    onClick={() => handleUpload("live")}
                                >
                                    {isUploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                                    Live Photo
                                </Button>
                            )}
                            {photoMeta.canUploadPromo && (
                                <Button
                                    variant="outline" size="sm"
                                    className="h-7 text-[10px] font-mono uppercase gap-1 border-blue-500/40 text-blue-600 hover:text-blue-600 rounded-lg"
                                    disabled={isUploadingPhoto}
                                    onClick={() => handleUpload("promo")}
                                >
                                    {isUploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />}
                                    Promo Media
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Upload status notices */}
                    {eventStatus === "upcoming" && !isManager && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                            <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <p className="text-[10px] text-blue-500 font-mono">Memory photos unlock after the event ends</p>
                        </div>
                    )}
                    {eventStatus === "upcoming" && isManager && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                            <Megaphone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <p className="text-[10px] text-blue-500 font-mono">Upload promo media to build hype for this event</p>
                        </div>
                    )}
                    {eventStatus === "ongoing" && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <Camera className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="text-[10px] text-amber-500 font-mono">
                                {isAttendee ? "Event is live! Share live photos now" : "Event is live! Attendees can share live photos"}
                            </p>
                        </div>
                    )}
                    {photoMeta.isLateUpload && isAttendee && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="text-[10px] text-amber-500 font-mono">Upload window ended — new photos will require manager approval</p>
                        </div>
                    )}
                    {photoMeta.isWithinWindow && isAttendee && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                            <Camera className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <p className="text-[10px] text-emerald-500 font-mono">Upload window open — {photoMeta.daysLeft} day{photoMeta.daysLeft !== 1 ? "s" : ""} remaining</p>
                        </div>
                    )}
                    {eventStatus === "completed" && !isAttendee && !isManager && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border border-border rounded-xl">
                            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <p className="text-[10px] text-muted-foreground font-mono">Only event attendees can upload memory photos</p>
                        </div>
                    )}

                    {/* Photo Grid */}
                    {approvedPhotos.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {approvedPhotos.map((photo: any, index: number) => (
                                <div key={photo._id} className={cn(
                                    "aspect-square rounded-xl overflow-hidden border border-border group/photo relative",
                                    index === 0 && approvedPhotos.length >= 5 && "col-span-2 row-span-2"
                                )}>
                                    <img
                                        src={photo.url}
                                        alt={photo.caption || "Event photo"}
                                        className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                    {photo.type === "live" && (
                                        <div className="absolute top-2 left-2">
                                            <Badge className="text-[7px] bg-amber-500 text-white border-none px-1.5 py-0.5 animate-pulse rounded-full shadow-sm">● LIVE</Badge>
                                        </div>
                                    )}
                                    {photo.type === "promo" && (
                                        <div className="absolute top-2 left-2">
                                            <Badge className="text-[7px] bg-blue-500 text-white border-none px-1.5 py-0.5 rounded-full shadow-sm">PROMO</Badge>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/70 via-black/20 to-transparent p-2.5 opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                        <p className="text-[9px] text-white font-mono truncate">{photo.uploaderName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-16 text-center border-2 border-dashed border-border rounded-xl bg-muted/5">
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                                <Camera className="w-7 h-7 text-muted-foreground/20" />
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground">No photos yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto">
                                {eventStatus === "upcoming" ? "Photos unlock after the event ends" : "Attendees can upload memory photos after the event"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

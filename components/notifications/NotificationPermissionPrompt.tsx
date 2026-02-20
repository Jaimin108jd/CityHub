"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Smart notification permission prompt.
 * Only shows AFTER user has joined their first group (engagement signal).
 * Never shows on login/first load.
 */
export function NotificationPermissionPrompt() {
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const updatePrefs = useMutation(api.notifications.updatePreferences);
    const savePush = useMutation(api.notifications.savePushSubscription);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("Notification" in window)) return;

        // Already granted or denied
        if (Notification.permission !== "default") return;

        // Check if user already dismissed
        try {
            const wasDismissed = localStorage.getItem("cityhub_notif_dismissed");
            if (wasDismissed) return;
        } catch (e) {
            console.warn("localStorage access denied:", e);
        }

        // Show after a delay (user should be engaged already)
        const timer = setTimeout(() => setVisible(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleEnable = useCallback(async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                await updatePrefs({ webNotificationsEnabled: true });

                // Register for Web Push if service worker available
                if ("serviceWorker" in navigator) {
                    const registration = await navigator.serviceWorker.ready;
                    const pushManager = (registration as any).pushManager;
                    if (!pushManager) return;
                    const subscription = await pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    });

                    const json = subscription.toJSON();
                    if (json.endpoint && json.keys) {
                        await savePush({
                            endpoint: json.endpoint,
                            p256dh: json.keys.p256dh ?? "",
                            auth: json.keys.auth ?? "",
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to enable notifications:", err);
        }
        setVisible(false);
    }, [updatePrefs, savePush]);

    const handleDismiss = useCallback(() => {
        setVisible(false);
        setDismissed(true);
        try {
            localStorage.setItem("cityhub_notif_dismissed", "true");
        } catch (e) {
            console.warn("localStorage access denied:", e);
        }
    }, []);

    if (!visible || dismissed) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-card border border-border rounded-xl shadow-lg p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">
                            Stay in the loop
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Get notified about governance decisions, mentions, and payments. We only send what matters.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleEnable}
                            >
                                <Bell className="w-3 h-3 mr-1" />
                                Enable
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={handleDismiss}
                            >
                                Not now
                            </Button>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

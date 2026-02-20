"use client";

import { useEffect } from "react";

/**
 * Register the CityHub service worker for web push notifications.
 * Only registers once per session.
 */
export function useServiceWorker() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            if (!("serviceWorker" in navigator)) return;

            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[SW] Registered:", registration.scope);
                })
                .catch((err) => {
                    console.error("[SW] Registration failed:", err);
                });
        } catch (error) {
            console.warn("[SW] Access restricted (likely by browser security settings):", error);
        }
    }, []);
}

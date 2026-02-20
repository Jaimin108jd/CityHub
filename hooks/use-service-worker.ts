"use client";

import { useEffect } from "react";

/**
 * Register the CityHub service worker for web push notifications.
 * Only registers once per session.
 */
export function useServiceWorker() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                console.log("[SW] Registered:", registration.scope);
            })
            .catch((err) => {
                // Ignore SecurityError caused by redirects (e.g., in dev environments or specific routing setups)
                if (err.name === 'SecurityError' && err.message.includes('redirect')) {
                    console.debug("[SW] Registration skipped: script is behind a redirect (expected in some environments).");
                    return;
                }
                console.error("[SW] Registration failed:", err);
            });
    }, []);
}

"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";

/**
 * Registers the service worker for web push notifications.
 * Placed in the root layout so it runs once globally.
 */
export function ServiceWorkerRegistrar() {
    useServiceWorker();
    return null;
}

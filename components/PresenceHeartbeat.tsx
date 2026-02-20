"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

export function PresenceHeartbeat() {
    const updatePresence = useMutation(api.users.updatePresence);
    const me = useQuery(api.users.getMyProfile);

    useEffect(() => {
        if (!me) return;

        // Initial heartbeat
        updatePresence();

        // Send heartbeat every 15 seconds for responsive presence
        const interval = setInterval(() => {
            updatePresence();
        }, 15_000);

        return () => clearInterval(interval);
    }, [me, updatePresence]);

    return null;
}

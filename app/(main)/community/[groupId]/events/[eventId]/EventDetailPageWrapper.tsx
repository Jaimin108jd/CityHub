"use client";

import { use } from "react";
import { Id } from "@/convex/_generated/dataModel";
import EventDetailPage from "@/components/community/EventDetailPage";

export function EventDetailPageWrapper({
    params,
}: {
    params: Promise<{ groupId: string; eventId: string }>;
}) {
    const { groupId, eventId } = use(params);
    return (
        <EventDetailPage
            groupId={groupId as Id<"groups">}
            eventId={eventId as Id<"events">}
        />
    );
}

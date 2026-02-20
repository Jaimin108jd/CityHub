"use client";

import { use } from "react";
import GroupDetailPageContent from "@/components/community/GroupDetailPage";
import { Id } from "@/convex/_generated/dataModel";

export default function GroupDetailPageWrapper({
    params,
}: {
    params: Promise<{ groupId: string }>;
}) {
    const { groupId } = use(params);
    return <GroupDetailPageContent groupId={groupId as Id<"groups">} />;
}

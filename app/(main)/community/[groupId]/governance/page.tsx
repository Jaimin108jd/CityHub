"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";

interface GovernancePageProps {
    params: Promise<{ groupId: Id<"groups"> }>;
}

export default function GovernancePage({ params }: GovernancePageProps) {
    const { groupId } = use(params);
    const router = useRouter();

    useEffect(() => {
        router.replace(`/community/${groupId}?tab=governance`);
    }, [groupId, router]);

    return null;
}

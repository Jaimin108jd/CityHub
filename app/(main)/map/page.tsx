"use client";

import { GlobalMap } from "@/components/community/GlobalMap";

export default function MapPage() {
    return (
        <div className="h-[calc(100vh-64px)] w-full overflow-hidden">
            <GlobalMap />
        </div>
    );
}

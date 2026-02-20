"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
    userId?: string;
    name?: string;
    avatarUrl?: string | null;
    className?: string;
}

export function ProfileAvatar({ userId, name, avatarUrl, className }: ProfileAvatarProps) {
    return (
        <Avatar className={cn("w-8 h-8 border border-border", className)}>
            <AvatarImage src={avatarUrl || ""} alt={name || "User"} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-mono uppercase">
                {name?.charAt(0) || "?"}
            </AvatarFallback>
        </Avatar>
    );
}

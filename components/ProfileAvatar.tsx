"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    className?: string;
    /** Show name text next to avatar */
    showName?: boolean;
    /** Additional text below name (e.g. role badge) */
    subtitle?: React.ReactNode;
    /** Disable click navigation */
    disableLink?: boolean;
}

/**
 * Clickable avatar that navigates to `/profile/[userId]`.
 * Drop-in replacement for raw Avatar usage throughout community pages.
 */
export function ProfileAvatar({
    userId,
    name,
    avatarUrl,
    className,
    showName = false,
    subtitle,
    disableLink = false,
}: ProfileAvatarProps) {
    const router = useRouter();

    const initials = name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    const handleClick = (e: React.MouseEvent) => {
        if (disableLink) return;
        e.stopPropagation();
        router.push(`/profile/${userId}`);
    };

    const avatar = (
        <Avatar
            className={cn(
                "border border-border transition-all",
                !disableLink && "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:scale-105",
                className
            )}
            onClick={handleClick}
        >
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                {initials}
            </AvatarFallback>
        </Avatar>
    );

    if (!showName) return avatar;

    return (
        <div
            className={cn("flex items-center gap-2.5 min-w-0", !disableLink && "cursor-pointer group")}
            onClick={handleClick}
        >
            {avatar}
            <div className="min-w-0">
                <p className={cn(
                    "text-sm font-semibold truncate",
                    !disableLink && "group-hover:text-primary transition-colors"
                )}>
                    {name}
                </p>
                {subtitle}
            </div>
        </div>
    );
}

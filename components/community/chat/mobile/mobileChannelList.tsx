"use client";

import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Hash, Volume2, Plus, MoreHorizontal, Pencil, Trash, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Channel {
    _id: Id<"channels">;
    name: string;
    isManagerOnlyPost?: boolean;
    type?: string;
}

interface MobileChannelListProps {
    channels: Channel[];
    selectedChannelId: Id<"channels"> | null;
    onSelect: (id: Id<"channels">) => void;
    isManager: boolean;
    mutedChannelIds: Set<Id<"channels">>;
    onCreateChannel: () => void;
    onEditChannel: (channel: Channel) => void;
    onDeleteChannel: (id: Id<"channels">) => void;
}

export function MobileChannelList({
    channels, selectedChannelId, onSelect, isManager,
    mutedChannelIds, onCreateChannel, onEditChannel, onDeleteChannel,
}: MobileChannelListProps) {
    return (
        <div className="flex flex-col h-full bg-background">
            {/* Section header */}
            <div className="px-4 pt-5 pb-2 shrink-0 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Text Channels
                </p>
                {isManager && (
                    <Button
                        onClick={onCreateChannel}
                        variant="outline"
                        size="sm"
                        className=" rounded-lg border-dashed text-muted-foreground hover:text-foreground"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-4">
                {channels.map((channel) => {
                    const isSelected = selectedChannelId === channel._id;
                    const isMuted = mutedChannelIds.has(channel._id);

                    return (
                        <div key={channel._id} className="relative group">
                            <button
                                onClick={() => onSelect(channel._id)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                                    isSelected
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                            >
                                {/* Active indicator pill */}
                                {isSelected && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                                )}
                                <span className={cn("shrink-0", isSelected ? "text-primary" : "text-muted-foreground/60")}>
                                    {channel.isManagerOnlyPost
                                        ? <Volume2 className="w-4 h-4" />
                                        : <Hash className="w-4 h-4" />
                                    }
                                </span>
                                <span className="truncate flex-1 text-left">{channel.name}</span>
                                {isMuted && <BellOff className="w-3 h-3 shrink-0 text-muted-foreground/40" />}
                            </button>

                            {isManager && channel.type === "custom" && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-36 rounded-xl shadow-lg">
                                            <DropdownMenuItem onClick={() => onEditChannel(channel)} className="rounded-lg cursor-pointer gap-2">
                                                <Pencil className="w-3.5 h-3.5" /> Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => onDeleteChannel(channel._id)}
                                                className="rounded-lg cursor-pointer gap-2 text-destructive focus:text-destructive"
                                            >
                                                <Trash className="w-3.5 h-3.5" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    );
                })}

                {channels.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Hash className="w-8 h-8 text-muted-foreground/20" />
                        <p className="text-xs text-muted-foreground/50">No channels yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
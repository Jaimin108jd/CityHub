"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Settings, Moon, Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`,
}));

export function NotificationSettings() {
    const [open, setOpen] = useState(false);
    const prefs = useQuery(api.notifications.getPreferences);
    const updatePrefs = useMutation(api.notifications.updatePreferences);

    const quietEnabled = prefs?.quietHoursEnabled ?? false;
    const quietStart = prefs?.quietHoursStart ?? 22;
    const quietEnd = prefs?.quietHoursEnd ?? 7;
    const webEnabled = prefs?.webNotificationsEnabled ?? false;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                render={
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                        <Settings className="w-3.5 h-3.5" />
                    </Button>
                }
            />
            <SheetContent side="right" className="w-85 sm:max-w-85">
                <SheetHeader>
                    <SheetTitle>Notification Settings</SheetTitle>
                    <SheetDescription>
                        Control how and when you receive notifications.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Web Notifications Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                webEnabled ? "bg-primary/10" : "bg-muted"
                            )}>
                                {webEnabled ? (
                                    <Bell className="w-4 h-4 text-primary" />
                                ) : (
                                    <BellOff className="w-4 h-4 text-muted-foreground" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium">Browser Notifications</p>
                                <p className="text-xs text-muted-foreground">For governance & mentions</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                if (!webEnabled && Notification.permission === "default") {
                                    const perm = await Notification.requestPermission();
                                    if (perm !== "granted") return;
                                }
                                await updatePrefs({ webNotificationsEnabled: !webEnabled });
                            }}
                            className={cn(
                                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                webEnabled ? "bg-primary" : "bg-muted"
                            )}
                        >
                            <span className={cn(
                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform",
                                webEnabled ? "translate-x-4" : "translate-x-0"
                            )} />
                        </button>
                    </div>

                    {/* Quiet Hours */}
                    <div className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    quietEnabled ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-muted"
                                )}>
                                    <Moon className={cn("w-4 h-4", quietEnabled ? "text-indigo-600" : "text-muted-foreground")} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Quiet Hours</p>
                                    <p className="text-xs text-muted-foreground">Pause critical alerts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updatePrefs({ quietHoursEnabled: !quietEnabled })}
                                className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                    quietEnabled ? "bg-indigo-600" : "bg-muted"
                                )}
                            >
                                <span className={cn(
                                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform",
                                    quietEnabled ? "translate-x-4" : "translate-x-0"
                                )} />
                            </button>
                        </div>

                        {quietEnabled && (
                            <div className="space-y-3 pt-3 border-t border-border">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                                        <select
                                            value={quietStart}
                                            onChange={(e) => updatePrefs({ quietHoursStart: parseInt(e.target.value) })}
                                            className="w-full h-8 px-2 text-xs rounded-md border border-border bg-background"
                                        >
                                            {HOURS.map(({ value, label }) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                                        <select
                                            value={quietEnd}
                                            onChange={(e) => updatePrefs({ quietHoursEnd: parseInt(e.target.value) })}
                                            className="w-full h-8 px-2 text-xs rounded-md border border-border bg-background"
                                        >
                                            {HOURS.map(({ value, label }) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground/70">
                                    During quiet hours, critical notifications are downgraded to in-app only. No browser popups.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <span className="font-semibold">Notification layers:</span>
                        </p>
                        <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-2 text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-muted-foreground"><span className="font-medium text-foreground">Critical</span> — Governance, mentions, payments</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-muted-foreground"><span className="font-medium text-foreground">Important</span> — Messages, polls, fund updates</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                <span className="text-muted-foreground"><span className="font-medium text-foreground">Activity</span> — Members, events, photos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

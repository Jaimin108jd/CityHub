"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Paperclip, ImageIcon, Mic } from "lucide-react";

export type UploadState =
    | { status: "idle" }
    | { status: "uploading"; progress: number; fileName?: string; fileType?: "image" | "file" | "voice" }
    | { status: "success"; fileName?: string }
    | { status: "error"; message?: string };

interface UploadProgressBarProps {
    uploadState: UploadState;
}

function FileIcon({ fileType }: { fileType?: "image" | "file" | "voice" }) {
    if (fileType === "image") return <ImageIcon className="w-3.5 h-3.5" />;
    if (fileType === "voice") return <Mic className="w-3.5 h-3.5" />;
    return <Paperclip className="w-3.5 h-3.5" />;
}

export function UploadProgressBar({ uploadState }: UploadProgressBarProps) {
    const [visible, setVisible] = useState(false);
    const [animateOut, setAnimateOut] = useState(false);

    useEffect(() => {
        if (uploadState.status === "uploading") {
            setAnimateOut(false);
            setVisible(true);
        } else if (uploadState.status === "success" || uploadState.status === "error") {
            // Show result briefly then fade out
            const timer = setTimeout(() => {
                setAnimateOut(true);
                setTimeout(() => setVisible(false), 400);
            }, 1800);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [uploadState.status]);

    if (!visible || uploadState.status === "idle") return null;

    const isUploading = uploadState.status === "uploading";
    const isSuccess = uploadState.status === "success";
    const isError = uploadState.status === "error";
    const progress = isUploading ? uploadState.progress : isSuccess ? 100 : 0;

    return (
        <div className={cn(
            "fixed top-0 left-0 right-0 z-[100] transition-all duration-400 ease-out",
            animateOut ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        )}>
            {/* Slim progress rail at very top */}
            <div className="h-0.5 bg-border/40 w-full">
                <div
                    className={cn(
                        "h-full transition-all duration-300 ease-out rounded-full",
                        isError ? "bg-destructive" : isSuccess ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Info pill */}
            <div className="flex justify-center pt-2 px-4 pointer-events-none">
                <div className={cn(
                    "flex items-center gap-2.5 px-4 py-2 rounded-2xl shadow-lg border text-xs font-medium",
                    "bg-background/90 backdrop-blur-xl",
                    isError
                        ? "border-destructive/30 text-destructive"
                        : isSuccess
                            ? "border-emerald-500/30 text-emerald-600"
                            : "border-border/60 text-foreground"
                )}>
                    {isUploading && (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                            <FileIcon fileType={uploadState.fileType} />
                            <span className="max-w-[160px] truncate">
                                {uploadState.fileName
                                    ? `Uploading ${uploadState.fileName}…`
                                    : uploadState.fileType === "voice"
                                        ? "Sending voice message…"
                                        : "Uploading file…"
                                }
                            </span>
                            <span className="text-muted-foreground/60 tabular-nums ml-1 shrink-0">
                                {Math.round(progress)}%
                            </span>
                        </>
                    )}
                    {isSuccess && (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{uploadState.fileName ? `${uploadState.fileName} sent` : "Sent!"}</span>
                        </>
                    )}
                    {isError && (
                        <>
                            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            <span>{uploadState.message || "Upload failed"}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
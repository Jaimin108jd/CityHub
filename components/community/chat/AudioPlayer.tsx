"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Loader2, Mic, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
    src: string;
    variant?: "sent" | "received" | "review";
    onDelete?: () => void;
    transcription?: string;
    transcriptionStatus?: string; // "pending" | "completed" | "failed"
}

// Generate stable pseudo-random bar heights from src string
function generateBars(src: string, count: number): number[] {
    const seed = src.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: count }, (_, i) => {
        const x = Math.sin(seed + i * 9.301) * 43758.5453;
        const rand = x - Math.floor(x);
        return 0.2 + rand * 0.8; // height 20%–100%
    });
}

export function AudioPlayer({ src, variant = "received", onDelete, transcription, transcriptionStatus }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);

    const hasTranscript = transcriptionStatus === "completed" && !!transcription;
    const isTranscribing = transcriptionStatus === "pending";

    const BAR_COUNT = 40;
    const bars = generateBars(src, BAR_COUNT);
    const progress = duration > 0 ? currentTime / duration : 0;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoaded = () => { setDuration(audio.duration); setIsLoading(false); };
        const onTimeUpdate = () => { if (!isDragging) setCurrentTime(audio.currentTime); };
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
        const onWaiting = () => setIsLoading(true);
        const onPlaying = () => setIsLoading(false);

        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("waiting", onWaiting);
        audio.addEventListener("playing", onPlaying);

        return () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("waiting", onWaiting);
            audio.removeEventListener("playing", onPlaying);
        };
    }, [isDragging]);

    const togglePlayPause = async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            await audio.play();
            setIsPlaying(true);
        }
    };

    const seekFromEvent = useCallback((clientX: number) => {
        const audio = audioRef.current;
        const el = progressRef.current;
        if (!audio || !el || !duration) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newTime = ratio * duration;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        seekFromEvent(e.clientX);
    };
    const handlePointerMove = (e: React.PointerEvent) => { if (isDragging) seekFromEvent(e.clientX); };
    const handlePointerUp = () => setIsDragging(false);

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const isReview = variant === "review";

    return (
        <>
            <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 select-none",
                "min-w-57.5 max-w-75",
                isReview
                    ? "bg-muted/50 border border-border/60 rounded-2xl"
                    : "bg-muted/40 border border-border/50",
                showTranscript && hasTranscript
                    ? "rounded-t-2xl rounded-b-none"
                    : "rounded-2xl"
            )}>
                <audio ref={audioRef} src={src} preload="metadata" />

                {/* Play/Pause Button */}
                <button
                    onClick={togglePlayPause}
                    className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150",
                        "bg-primary/10 hover:bg-primary/20 text-primary active:scale-95"
                    )}
                >
                    {isLoading && isPlaying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                    ) : (
                        <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    )}
                </button>

                {/* Waveform + Time */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    {/* Waveform scrubber */}
                    <div
                        ref={progressRef}
                        className="flex items-center gap-px h-8 cursor-pointer touch-none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        {bars.map((height, i) => {
                            const barProgress = i / BAR_COUNT;
                            const isActive = barProgress <= progress;
                            const isHead = Math.abs(barProgress - progress) < 1.5 / BAR_COUNT;
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex-1 rounded-full transition-colors duration-75",
                                        isHead
                                            ? "bg-primary"
                                            : isActive
                                                ? "bg-primary/70"
                                                : "bg-muted-foreground/25"
                                    )}
                                    style={{ height: `${height * 100}%` }}
                                />
                            );
                        })}
                    </div>

                    {/* Time display */}
                    <div className="flex justify-between px-0.5">
                        <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                            {formatTime(currentTime)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* Mic / Transcript toggle icon */}
                <div className="shrink-0">
                    {isTranscribing ? (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <Loader2 className="w-3.5 h-3.5 text-primary/60 animate-spin" />
                        </div>
                    ) : hasTranscript ? (
                        <button
                            onClick={() => setShowTranscript(!showTranscript)}
                            className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150",
                                showTranscript
                                    ? "bg-primary text-primary-foreground scale-105"
                                    : "bg-primary/10 text-primary/70 hover:bg-primary/20 hover:text-primary"
                            )}
                            title={showTranscript ? "Hide transcript" : "Show transcript"}
                        >
                            {showTranscript ? (
                                <X className="w-3.5 h-3.5" />
                            ) : (
                                <FileText className="w-3.5 h-3.5" />
                            )}
                        </button>
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/8 flex items-center justify-center">
                            <Mic className="w-3.5 h-3.5 text-primary/60" />
                        </div>
                    )}
                </div>
            </div>

            {/* Transcript panel — slides open below the player */}
            {showTranscript && hasTranscript && (
                <div className="px-3 py-2 bg-muted/30 border border-t-0 border-border/40 rounded-b-2xl -mt-1 min-w-57.5 max-w-75 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {transcription}
                    </p>
                </div>
            )}
        </>
    );
}
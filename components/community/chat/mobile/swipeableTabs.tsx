"use client";

import { useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = "channels" | "chat" | "members";
const TAB_ORDER: Tab[] = ["channels", "chat", "members"];

interface SwipeableTabsProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    children: [ReactNode, ReactNode, ReactNode]; // channels, chat, members
}

const SWIPE_THRESHOLD = 50;  // px to commit a swipe
const VELOCITY_THRESHOLD = 0.3; // px/ms

export function SwipeableTabs({ activeTab, onTabChange, children }: SwipeableTabsProps) {
    const activeIndex = TAB_ORDER.indexOf(activeTab);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track drag gesture state
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const touchStartTime = useRef<number>(0);
    const isDraggingRef = useRef(false);
    const isScrollingVertically = useRef<boolean | null>(null); // null = undecided

    // Animated offset: 0 = no drag, negative = dragging left (revealing next tab)
    const [dragOffset, setDragOffset] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    // Translate: base position (from activeIndex) + drag offset
    const baseTranslate = -activeIndex * 100; // in percent
    const dragPercent = containerRef.current && containerRef.current.offsetWidth > 0
        ? (dragOffset / containerRef.current.offsetWidth) * 100
        : 0;

    const totalTranslate = baseTranslate + dragPercent;

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        // Don't capture if touch starts on interactive elements
        const target = e.target as HTMLElement;
        if (
            target.closest('textarea') ||
            target.closest('input') ||
            target.closest('button') ||
            target.closest('[role="button"]') ||
            target.closest('[data-no-swipe]')
        ) return;

        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        isDraggingRef.current = true;
        isScrollingVertically.current = null;
        setIsAnimating(false);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDraggingRef.current) return;

        const dx = e.touches[0].clientX - touchStartX.current;
        const dy = e.touches[0].clientY - touchStartY.current;

        // First significant movement decides direction
        if (isScrollingVertically.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isScrollingVertically.current = Math.abs(dy) > Math.abs(dx);
        }

        if (isScrollingVertically.current) return; // let scroll happen naturally

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault();

        // Rubber-band at edges
        let clampedDx = dx;
        if (activeIndex === 0 && dx > 0) clampedDx = dx * 0.25;
        if (activeIndex === TAB_ORDER.length - 1 && dx < 0) clampedDx = dx * 0.25;

        setDragOffset(clampedDx);
    }, [activeIndex]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!isDraggingRef.current || isScrollingVertically.current) {
            isDraggingRef.current = false;
            setDragOffset(0);
            return;
        }

        const dx = dragOffset;
        const dt = Date.now() - touchStartTime.current;
        const velocity = Math.abs(dx) / dt; // px/ms

        const shouldSwipe = Math.abs(dx) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

        setIsAnimating(true);
        setDragOffset(0);

        if (shouldSwipe) {
            if (dx < 0 && activeIndex < TAB_ORDER.length - 1) {
                onTabChange(TAB_ORDER[activeIndex + 1]);
            } else if (dx > 0 && activeIndex > 0) {
                onTabChange(TAB_ORDER[activeIndex - 1]);
            }
        }

        isDraggingRef.current = false;
        isScrollingVertically.current = null;
    }, [dragOffset, activeIndex, onTabChange]);

    // After animation completes
    useEffect(() => {
        if (!isAnimating) return;
        const t = setTimeout(() => setIsAnimating(false), 320);
        return () => clearTimeout(t);
    }, [isAnimating, activeTab]);

    return (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* Sliding panels */}
            <div
                className="flex-1 overflow-hidden relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    ref={containerRef}
                    className="flex h-full w-full"
                    style={{
                        transform: `translateX(${totalTranslate}%)`,
                        transition: isAnimating || dragOffset === 0 && !isDraggingRef.current
                            ? "transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                            : "none",
                        willChange: "transform",
                    }}
                >
                    {children.map((child, i) => (
                        <div
                            key={i}
                            className="w-full h-full shrink-0 overflow-hidden"
                            style={{
                                // Fade adjacent tabs slightly when dragging
                                opacity: i === activeIndex
                                    ? 1
                                    : isAnimating
                                        ? 0.85
                                        : 1 - Math.abs(dragPercent / 100) * 0.15,
                                transition: isAnimating ? "opacity 300ms ease" : "none",
                            }}
                            aria-hidden={i !== activeIndex}
                        >
                            {child}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
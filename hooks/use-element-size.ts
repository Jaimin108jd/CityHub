"use client";

import { useState, useCallback, useEffect } from "react";

export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const [ref, setRef] = useState<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const handleSize = useCallback(() => {
    setSize({
      width: ref?.offsetWidth || 0,
      height: ref?.offsetHeight || 0,
    });
  }, [ref]);

  useEffect(() => {
    if (!ref) return;
    handleSize();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      handleSize();
    });

    observer.observe(ref);
    return () => {
      observer.disconnect();
    };
  }, [ref, handleSize]);

  return [setRef, size] as const;
}

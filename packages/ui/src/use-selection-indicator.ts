"use client";

import { useLayoutEffect, useRef } from "react";

// Measure only on selection/layout changes. The indicator is absolute and cannot
// resize its host; CSS zoom is removed from the viewport-relative measurements.
export function useSelectionIndicator(value: string, selector: string) {
  const hostRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const indicator = indicatorRef.current;
    if (!host || !indicator) return;
    let disposed = false;
    let frame = 0;
    const measure = () => {
      if (disposed) return;
      const target = host.querySelector<HTMLElement>(selector);
      if (!target || !target.getClientRects().length) {
        indicator.dataset.visible = "false";
        indicator.dataset.animate = "false";
        return;
      }
      const outer = host.getBoundingClientRect();
      const inner = target.getBoundingClientRect();
      const scale = outer.width / parseFloat(getComputedStyle(host).width) || 1;
      const values = {
        x: (inner.left - outer.left) / scale - host.clientLeft,
        y: (inner.top - outer.top) / scale - host.clientTop,
        width: inner.width / scale,
        height: inner.height / scale,
      };
      for (const [key, number] of Object.entries(values))
        indicator.style.setProperty(`--indicator-${key}`, `${number}px`);
      indicator.dataset.visible = "true";
      host.dataset.indicatorReady = "true";
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!disposed) indicator.dataset.animate = "true";
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    for (const child of host.querySelectorAll<HTMLElement>("[data-indicator-target]"))
      observer.observe(child);
    window.addEventListener("resize", measure);
    document.fonts.addEventListener("loadingdone", measure);
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [value, selector]);
  return { hostRef, indicatorRef };
}

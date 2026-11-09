"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  const isNavigatingRef = useRef(false);
  const visibleRef = useRef(false);
  const targetUrlRef = useRef<string | null>(null);
  const lastPathnameRef = useRef(pathname);
  const lastSearchRef = useRef(searchParams?.toString() ?? "");

  const hysteresisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crawlTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crawlTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const clearAllTimers = useCallback(() => {
    if (hysteresisTimerRef.current) clearTimeout(hysteresisTimerRef.current);
    if (crawlTimer1Ref.current) clearTimeout(crawlTimer1Ref.current);
    if (crawlTimer2Ref.current) clearTimeout(crawlTimer2Ref.current);
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const startNavigation = useCallback((targetUrl: string) => {
    clearAllTimers();
    targetUrlRef.current = targetUrl;
    isNavigatingRef.current = true;
    setFading(false);

    // 80ms Hysteresis Gate: only show progress bar if transition takes > 80ms
    hysteresisTimerRef.current = setTimeout(() => {
      if (!isNavigatingRef.current) return;
      setVisible(true);
      setProgress(35);

      // Crawl to 70% at 300ms from start (220ms after hysteresis)
      crawlTimer1Ref.current = setTimeout(() => {
        if (!isNavigatingRef.current) return;
        setProgress(70);
      }, 220);

      // Crawl to 90% at 800ms from start (720ms after hysteresis)
      crawlTimer2Ref.current = setTimeout(() => {
        if (!isNavigatingRef.current) return;
        setProgress(90);
      }, 720);
    }, 80);

    // 2.0s Watchdog: auto-cleanup and fire retry toast if navigation stalls
    watchdogTimerRef.current = setTimeout(() => {
      if (!isNavigatingRef.current) return;
      isNavigatingRef.current = false;
      const failedUrl = targetUrlRef.current;
      clearAllTimers();
      setFading(true);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
        setFading(false);
      }, 200);

      toast.error("Navigation timed out. Please check your connection.", {
        action: failedUrl
          ? {
              label: "Retry",
              onClick: () => window.location.assign(failedUrl),
            }
          : undefined,
      });
    }, 2000);
  }, [clearAllTimers]);

  // Capture-phase link click interception and popstate event listening
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("href")?.startsWith("#") ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }

      const hrefAttr = anchor.getAttribute("href") ?? "";
      if (
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:") ||
        hrefAttr.startsWith("javascript:")
      ) {
        return;
      }

      const currentPathWithSearch = window.location.pathname + window.location.search;
      const targetPathWithSearch = anchor.pathname + anchor.search;
      if (currentPathWithSearch === targetPathWithSearch) {
        return;
      }

      startNavigation(anchor.href);
    };

    const handlePopState = () => {
      startNavigation(window.location.href);
    };

    // Registered in capture phase so it fires before React calls preventDefault()
    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      clearAllTimers();
    };
  }, [startNavigation, clearAllTimers]);

  // Completion effect: reacts to pathname & searchParams changes
  useEffect(() => {
    const currentSearch = searchParams?.toString() ?? "";
    const hasPathChanged = pathname !== lastPathnameRef.current;
    const hasSearchChanged = currentSearch !== lastSearchRef.current;

    lastPathnameRef.current = pathname;
    lastSearchRef.current = currentSearch;

    if (!hasPathChanged && !hasSearchChanged) return;

    if (isNavigatingRef.current || visibleRef.current) {
      isNavigatingRef.current = false;
      if (hysteresisTimerRef.current) clearTimeout(hysteresisTimerRef.current);
      if (crawlTimer1Ref.current) clearTimeout(crawlTimer1Ref.current);
      if (crawlTimer2Ref.current) clearTimeout(crawlTimer2Ref.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);

      const wasVisible = visibleRef.current;
      setTimeout(() => {
        if (wasVisible) {
          setProgress(100);
          finishTimerRef.current = setTimeout(() => {
            setFading(true);
            resetTimerRef.current = setTimeout(() => {
              setVisible(false);
              setProgress(0);
              setFading(false);
            }, 200);
          }, 100);
        } else {
          setVisible(false);
          setProgress(0);
          setFading(false);
        }
      }, 0);
    }
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-hidden={!visible}
      style={{
        position: "fixed",
        top: "env(safe-area-inset-top, 0px)",
        left: 0,
        right: 0,
        height: "2.5px",
        zIndex: 99999,
        pointerEvents: "none",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: prefersReducedMotion ? "100%" : `${progress}%`,
          backgroundColor: "#C65B3B",
          boxShadow: "0 0 10px #E5983B",
          opacity: fading ? 0 : 1,
          transition: prefersReducedMotion
            ? "opacity 200ms ease"
            : progress === 100
              ? "width 100ms ease-out, opacity 200ms ease-in-out"
              : "width 200ms ease-out, opacity 200ms ease-in-out",
        }}
      />
    </div>
  );
}

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearUserCache,
  registerConnectionReporter,
  triggerGlobalRevalidate,
} from "@/lib/cache/swr-cache";

export type ConnectionState =
  | "CONNECTED"
  | "DEGRADED_CACHED"
  | "RECONNECTING"
  | "OFFLINE_EMPTY";

export interface DatabaseStatusValue {
  state: ConnectionState;
  lastSyncTime: number | null;
  isDegraded: boolean;
  setDegraded: (timestamp?: number | null) => void;
  setConnected: () => void;
  retryNow: () => Promise<void>;
  clearUserCache: (userId: string) => void;
}

const DatabaseStatusContext = createContext<DatabaseStatusValue | undefined>(undefined);

export function DatabaseStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ConnectionState>("CONNECTED");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBeaconTimeRef = useRef<number>(0);

  const setConnected = useCallback(() => {
    setState("CONNECTED");
    reconnectAttemptRef.current = 0;
  }, []);

  const setDegraded = useCallback((timestamp?: number | null) => {
    setState((prev) => {
      // If already reconnecting, don't revert to degraded until check finishes
      if (prev === "RECONNECTING") return prev;
      return timestamp ? "DEGRADED_CACHED" : "OFFLINE_EMPTY";
    });
    if (timestamp !== undefined) {
      setLastSyncTime(timestamp);
    }
  }, []);

  // Sync with SWR cache query reporters
  useEffect(() => {
    const unregister = registerConnectionReporter({
      onDegraded: (ts) => setDegraded(ts),
      onConnected: () => setConnected(),
    });
    return unregister;
  }, [setDegraded, setConnected]);

  // Execute health check probe
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/health", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        setConnected();
        triggerGlobalRevalidate();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [setConnected]);

  // Force immediate retry
  const retryNow = useCallback(async () => {
    setState("RECONNECTING");
    const ok = await checkHealth();
    if (!ok) {
      setState(lastSyncTime ? "DEGRADED_CACHED" : "OFFLINE_EMPTY");
    }
  }, [checkHealth, lastSyncTime]);

  // Jittered exponential backoff polling when not CONNECTED
  useEffect(() => {
    if (state === "CONNECTED") {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      reconnectAttemptRef.current = 0;
      return;
    }

    const scheduleNextPoll = () => {
      const attempt = reconnectAttemptRef.current;
      const baseInterval = Math.min(30000, 3000 * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseInterval + jitter;

      pollTimerRef.current = setTimeout(async () => {
        reconnectAttemptRef.current += 1;
        const ok = await checkHealth();
        if (!ok) {
          scheduleNextPoll();
        }
      }, delay);
    };

    scheduleNextPoll();

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [state, checkHealth]);

  // Proactive Wakeup Beacon: initial load & window focus (throttled to 60s)
  useEffect(() => {
    const fireBeacon = () => {
      const now = Date.now();
      if (now - lastBeaconTimeRef.current < 60000) return;
      lastBeaconTimeRef.current = now;

      // Keepalive beacon to warm up Supabase
      try {
        fetch("/api/health", { keepalive: true }).catch(() => {});
      } catch {}
    };

    fireBeacon();
    window.addEventListener("focus", fireBeacon);
    return () => {
      window.removeEventListener("focus", fireBeacon);
    };
  }, []);

  const isDegraded = state !== "CONNECTED";

  return (
    <DatabaseStatusContext.Provider
      value={{
        state,
        lastSyncTime,
        isDegraded,
        setDegraded,
        setConnected,
        retryNow,
        clearUserCache,
      }}
    >
      {children}
    </DatabaseStatusContext.Provider>
  );
}

export function useDatabaseStatus() {
  const ctx = useContext(DatabaseStatusContext);
  if (!ctx) {
    throw new Error("useDatabaseStatus must be used within DatabaseStatusProvider");
  }
  return ctx;
}

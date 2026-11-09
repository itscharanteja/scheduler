"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface CacheEntry<T> {
  data: T;
  timestamp: number; // Date.now()
  locationId: string;
  userId: string;
  version: number;
}

const CACHE_VERSION = 1;
const MAX_CACHE_BYTES = 3 * 1024 * 1024; // 3MB limit
const TARGET_EVICT_BYTES = 2.5 * 1024 * 1024; // Evict down to 2.5MB

// In-memory snapshot map to guarantee referential stability for useSyncExternalStore
const memoryCache = new Map<string, CacheEntry<unknown>>();
const listenersByKey = new Map<string, Set<() => void>>();
const inFlightQueries = new Map<string, Promise<unknown>>();
const lastFetchTimeByKey = new Map<string, number>();
const revalidateListeners = new Set<() => void>();

function subscribeKey(storageKey: string, listener: () => void): () => void {
  let keyListeners = listenersByKey.get(storageKey);
  if (!keyListeners) {
    keyListeners = new Set();
    listenersByKey.set(storageKey, keyListeners);
  }
  keyListeners.add(listener);
  return () => {
    keyListeners?.delete(listener);
    if (keyListeners && keyListeners.size === 0) {
      listenersByKey.delete(storageKey);
    }
  };
}

function notifyKey(storageKey: string) {
  const keyListeners = listenersByKey.get(storageKey);
  if (keyListeners) {
    for (const listener of Array.from(keyListeners)) {
      listener();
    }
  }
}

/** Global trigger to tell all active useCachedQuery hooks to refetch fresh data */
export function triggerGlobalRevalidate() {
  for (const revalidate of revalidateListeners) {
    revalidate();
  }
}

// Global connection state hooks for swr-cache notifications
type ConnectionReporter = {
  onDegraded?: (timestamp: number | null) => void;
  onConnected?: () => void;
};
const connectionReporters = new Set<ConnectionReporter>();

export function registerConnectionReporter(reporter: ConnectionReporter): () => void {
  connectionReporters.add(reporter);
  return () => {
    connectionReporters.delete(reporter);
  };
}

function reportDegraded(timestamp: number | null) {
  for (const r of connectionReporters) {
    r.onDegraded?.(timestamp);
  }
}

function reportConnected() {
  for (const r of connectionReporters) {
    r.onConnected?.();
  }
}

/** Build strictly isolated cache key */
export function buildCacheKey(userId: string, locationId: string, entityKey: string): string {
  const safeUser = userId || "anonymous";
  const safeLoc = locationId || "global";
  return `skift:cache:${safeUser}:${safeLoc}:${entityKey}`;
}

/** Enforce LRU eviction if cache exceeds 3MB */
function enforceLRUEviction() {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    let totalBytes = 0;
    const entries: { key: string; timestamp: number; size: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("skift:cache:")) {
        const val = localStorage.getItem(k) ?? "";
        const size = (k.length + val.length) * 2; // rough UTF-16 byte estimate
        totalBytes += size;
        let ts = 0;
        try {
          const parsed = JSON.parse(val);
          ts = parsed.timestamp || 0;
        } catch {
          ts = 0;
        }
        entries.push({ key: k, timestamp: ts, size });
      }
    }

    if (totalBytes > MAX_CACHE_BYTES) {
      // Sort oldest first
      entries.sort((a, b) => a.timestamp - b.timestamp);
      for (const entry of entries) {
        localStorage.removeItem(entry.key);
        memoryCache.delete(entry.key);
        notifyKey(entry.key);
        totalBytes -= entry.size;
        if (totalBytes <= TARGET_EVICT_BYTES) break;
      }
    }
  } catch (err) {
    console.warn("[swr-cache] LRU eviction error:", err);
  }
}

export function getCacheEntry<T>(storageKey: string): CacheEntry<T> | undefined {
  if (memoryCache.has(storageKey)) {
    return memoryCache.get(storageKey) as CacheEntry<T>;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed && typeof parsed.timestamp === "number" && parsed.version === CACHE_VERSION) {
      memoryCache.set(storageKey, parsed);
      return parsed;
    }
    // Invalid version or corrupt
    localStorage.removeItem(storageKey);
  } catch {
    // ignore parse errors
  }
  return undefined;
}

export function setCacheEntry<T>(
  storageKey: string,
  entry: CacheEntry<T>
): void {
  const existing = memoryCache.get(storageKey);
  if (existing && existing.timestamp === entry.timestamp) {
    return;
  }

  memoryCache.set(storageKey, entry);

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      enforceLRUEviction();
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (err) {
      console.warn("[swr-cache] Failed to write localStorage, attempting eviction:", err);
      try {
        enforceLRUEviction();
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch {
        // storage quota completely full, retain in memory only
      }
    }
  }

  notifyKey(storageKey);
}

/** Clear all cached records belonging to a user upon logout */
export function clearUserCache(userId: string): void {
  if (!userId) return;
  const prefix = `skift:cache:${userId}:`;

  // Clear memory cache
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
      notifyKey(k);
    }
  }

  // Clear localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        localStorage.removeItem(k);
        notifyKey(k);
      }
    } catch (err) {
      console.error("[swr-cache] Error clearing user cache:", err);
    }
  }
}

export interface UseCachedQueryOptions {
  locationId: string;
  userId?: string;
  ttlMs?: number; // Default 10 minutes
  timeoutMs?: number; // Default 3,500ms
  isEditing?: boolean; // Fencing: prevents view overwrite when editing
}

export interface UseCachedQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isCached: boolean;
  isDegraded: boolean;
  lastSync: number | null;
  error: Error | null;
  hasStagedUpdate: boolean;
  applyStagedUpdate: () => void;
  refetch: () => Promise<void>;
}

export function useCachedQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseCachedQueryOptions
): UseCachedQueryResult<T> {
  const {
    locationId,
    userId = "anonymous",
    timeoutMs = 3500,
    isEditing = false,
  } = options;

  const storageKey = buildCacheKey(userId, locationId, key);

  // Keep fetcher and options in refs so inline arrow functions never trigger re-render loops
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

  const timeoutMsRef = useRef(timeoutMs);
  timeoutMsRef.current = timeoutMs;

  const locationIdRef = useRef(locationId);
  locationIdRef.current = locationId;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Subscribe to external store for zero-mismatch synchronous hydration, keyed per storageKey
  const cachedEntry = useSyncExternalStore(
    (onStoreChange) => subscribeKey(storageKey, onStoreChange),
    () => (isHydrated ? getCacheEntry<T>(storageKey) : undefined),
    () => undefined
  );

  const [liveData, setLiveData] = useState<T | undefined>(undefined);
  const liveDataRef = useRef<T | undefined>(undefined);
  liveDataRef.current = liveData;

  const [stagedData, setStagedData] = useState<T | undefined>(undefined);
  const [hasStagedUpdate, setHasStagedUpdate] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const effectiveData: T | undefined = isHydrated
    ? (liveData !== undefined ? liveData : cachedEntry?.data)
    : undefined;
  const isCached = isHydrated && liveData === undefined && cachedEntry !== undefined;
  const lastSync = isHydrated ? (cachedEntry?.timestamp ?? null) : null;
  const isLoading = !isHydrated || (!cachedEntry && liveData === undefined);

  const applyStagedUpdate = useCallback(() => {
    if (stagedData !== undefined) {
      setLiveData(stagedData);
      setStagedData(undefined);
      setHasStagedUpdate(false);
    }
  }, [stagedData]);

  const executeFetch = useCallback(
    async (signal?: AbortSignal, force = false): Promise<void> => {
      // Avoid rapid refetching if fetched recently (< 1.5s) unless force is true
      const now = Date.now();
      const lastFetch = lastFetchTimeByKey.get(storageKey) ?? 0;
      if (!force && now - lastFetch < 1500) {
        return;
      }

      // If a request for this exact storage key is already in flight, reuse it
      let promise = inFlightQueries.get(storageKey) as Promise<T> | undefined;

      if (!promise) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort(new Error("Query timeout exceeded threshold"));
        }, timeoutMsRef.current);

        // Chain caller's signal if provided
        if (signal) {
          signal.addEventListener("abort", () => controller.abort());
        }

        promise = (async () => {
          try {
            return await fetcherRef.current(controller.signal);
          } finally {
            clearTimeout(timeoutId);
            inFlightQueries.delete(storageKey);
            lastFetchTimeByKey.set(storageKey, Date.now());
          }
        })();

        inFlightQueries.set(storageKey, promise);
      }

      try {
        setError(null);

        const fresh = await promise;

        // Successful revalidation
        setIsDegraded(false);
        reportConnected();

        const newEntry: CacheEntry<T> = {
          data: fresh,
          timestamp: Date.now(),
          locationId: locationIdRef.current,
          userId: userIdRef.current,
          version: CACHE_VERSION,
        };

        // Edit Fencing: if user is currently editing, do not overwrite view
        if (isEditingRef.current) {
          setStagedData(fresh);
          setHasStagedUpdate(true);
          setCacheEntry(storageKey, newEntry);
        } else {
          setLiveData(fresh);
          setCacheEntry(storageKey, newEntry);
        }
      } catch (err: unknown) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        console.warn(`[swr-cache] Fetch failed for ${storageKey}:`, normalized.message);

        // Network abort / timeout / 503 / 504 -> Degraded mode
        const isNetworkFailure =
          normalized.name === "AbortError" ||
          normalized.name === "NetworkError" ||
          /timeout|aborted|network|failed to fetch|503|504/i.test(normalized.message);

        if (isNetworkFailure) {
          setIsDegraded(true);
          const currentCache = getCacheEntry<T>(storageKey);
          reportDegraded(currentCache?.timestamp ?? null);
          if (currentCache) {
            setError(null);
          } else {
            setError(normalized);
          }
        } else {
          setError(normalized);
        }
      }
    },
    [storageKey]
  );

  // Execute on mount or when storageKey changes
  useEffect(() => {
    const controller = new AbortController();
    void executeFetch(controller.signal);

    const onRevalidate = () => {
      void executeFetch(undefined, true);
    };
    revalidateListeners.add(onRevalidate);

    return () => {
      controller.abort();
      revalidateListeners.delete(onRevalidate);
    };
  }, [storageKey, executeFetch]);

  const forceRefetch = useCallback(() => executeFetch(undefined, true), [executeFetch]);

  return {
    data: effectiveData,
    isLoading,
    isCached,
    isDegraded,
    lastSync,
    error,
    hasStagedUpdate,
    applyStagedUpdate,
    refetch: forceRefetch,
  };
}

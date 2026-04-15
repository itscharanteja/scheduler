"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getLocations } from "@/lib/supabase";
import { LOCATION_ID } from "@/lib/constants";
import type { Location } from "@/lib/types";

const STORAGE_KEY = "skift_location_id";

interface LocationContextValue {
  locationId: string;
  locations: Location[];
  setLocationId: (id: string) => void;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({
  children,
  isSuperAdmin,
}: {
  children: ReactNode;
  isSuperAdmin: boolean;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationIdState] = useState<string>(LOCATION_ID);

  useEffect(() => {
    if (!isSuperAdmin) return;

    getLocations().then((locs) => {
      if (locs.length === 0) return;
      setLocations(locs);

      // Restore persisted selection, fall back to first location
      const stored = typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      const valid = stored && locs.some((l) => l.id === stored);
      setLocationIdState(valid ? stored! : locs[0].id);
    });
  }, [isSuperAdmin]);

  const setLocationId = useCallback((id: string) => {
    setLocationIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  return (
    <LocationContext.Provider value={{ locationId, locations, setLocationId }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}

"use client";

import React, { useMemo } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useDatabaseStatus } from "@/context/DatabaseStatusContext";
import { useLanguage } from "@/context/LanguageContext";

function formatTimeAgo(timestamp: number, lang: "en" | "sv"): string {
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 30) {
    return lang === "sv" ? "just nu" : "just now";
  }
  if (elapsedSec < 60) {
    return lang === "sv" ? `${elapsedSec} sekunder sedan` : `${elapsedSec}s ago`;
  }
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) {
    return lang === "sv" ? `${elapsedMin} min sedan` : `${elapsedMin}m ago`;
  }
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = new Date().toDateString() === date.toDateString();
  if (isToday) {
    return lang === "sv" ? `idag kl ${timeStr}` : `today at ${timeStr}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ReconnectionBanner() {
  const { state, lastSyncTime, retryNow } = useDatabaseStatus();
  const { lang } = useLanguage();

  const formattedTimeAgo = useMemo(() => {
    if (!lastSyncTime) return null;
    return formatTimeAgo(lastSyncTime, lang);
  }, [lastSyncTime, lang]);

  if (state === "CONNECTED") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F0D5A8] bg-[#FFF8E6] px-4 py-2.5 text-xs text-[#8C5E1E] shadow-sm transition-all animate-page-enter"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {state === "RECONNECTING" ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8C5E1E]" />
        ) : state === "DEGRADED_CACHED" ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E5983B] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C65B3B]" />
          </span>
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-[#8C5E1E]" />
        )}

        <div className="min-w-0 truncate font-medium">
          {state === "RECONNECTING" ? (
            <span>
              {lang === "sv"
                ? "Återupprättar anslutning till databasen..."
                : "Re-establishing connection to database..."}
            </span>
          ) : state === "DEGRADED_CACHED" ? (
            <span>
              {lang === "sv" ? (
                <>
                  Visar cachad data{formattedTimeAgo ? ` (synkad ${formattedTimeAgo})` : ""} —
                  Återansluter till databasen i bakgrunden...
                </>
              ) : (
                <>
                  Showing cached data{formattedTimeAgo ? ` (synced ${formattedTimeAgo})` : ""} —
                  Reconnecting to database in background...
                </>
              )}
            </span>
          ) : (
            <span>
              {lang === "sv"
                ? "Ansluter till databasen — Ingen lokal cache för denna enhet."
                : "Connecting to database — No local cache for this branch."}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={state === "RECONNECTING"}
        onClick={() => void retryNow()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0BC85] bg-[#FFFDFB] px-2.5 py-1 text-xs font-semibold text-[#8C5E1E] transition-colors hover:bg-[#FBEAD9] disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${state === "RECONNECTING" ? "animate-spin" : ""}`} />
        <span>{lang === "sv" ? "Försök nu" : "Retry Now"}</span>
      </button>
    </div>
  );
}

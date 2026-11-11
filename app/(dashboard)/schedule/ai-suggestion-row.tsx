"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isScheduleDate, overlappingAssignments, readSuggestionAssignments, scheduleRosterRevision,
  type ScheduleSuggestionResult,
} from "@/lib/schedule-suggestions";
import { supabaseClient } from "@/lib/supabase/client";
import { getMockDataStore } from "@/lib/supabase/mock-store";

const copy = {
  en: {
    title: "AI suggestion",
    loading: "Checking the saved schedule…",
    saving: "Waiting for shift changes to save…",
    generating: "Checking the forecast and staffing…",
    empty: "First schedule some people on this day or try with AI scheduling to start with",
    refresh: "Refresh suggestion",
    retry: "Retry",
    schedule: "Schedule unavailable",
    forecast: "Forecast unavailable",
    model: "AI explanation unavailable",
    scheduled: "scheduled",
    add: "Add",
    reduce: "Reduce by",
    keep: "Keep coverage",
    review: "Review coverage",
  },
  sv: {
    title: "AI-förslag",
    loading: "Kontrollerar det sparade schemat…",
    saving: "Väntar på att passen sparas…",
    generating: "Kontrollerar prognosen och bemanningen…",
    empty: "Schemalägg först några personer den här dagen eller prova AI-schemaläggning för att komma igång",
    refresh: "Uppdatera förslag",
    retry: "Försök igen",
    schedule: "Schemat är inte tillgängligt",
    forecast: "Prognosen är inte tillgänglig",
    model: "AI-förklaringen är inte tillgänglig",
    scheduled: "schemalagda",
    add: "Lägg till",
    reduce: "Minska med",
    keep: "Behåll bemanningen",
    review: "Granska bemanningen",
  },
};

type Props = {
  date: string;
  locationId: string;
  lang: "en" | "sv";
  saving: boolean;
  rosterVersion: number;
  scheduleSync: number | null;
  userId?: string;
};

export function AiSuggestionRow(props: Props) {
  const [panel, setPanel] = useState({ open: false, openings: 0 });

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        aria-expanded={panel.open}
        aria-controls="staffing-suggestion"
        onClick={() => setPanel(({ open, openings }) => ({ open: !open, openings: openings + Number(!open) }))}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-slate-100"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          {copy[props.lang].title}
        </span>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${panel.open ? "rotate-90" : ""}`} />
      </button>
      <SelectedDaySuggestion
        key={JSON.stringify([props.userId, props.locationId, props.date, props.rosterVersion, props.lang])}
        {...props}
        {...panel}
      />
    </div>
  );
}

type RosterCheck =
  | { attempt: number; status: "empty" | "staffed"; revision: string; changed: boolean }
  | { attempt: number; status: "unavailable" };

function SelectedDaySuggestion({ date, locationId, lang, open, openings, saving, scheduleSync }: Props & {
  open: boolean;
  openings: number;
}) {
  const t = copy[lang];
  const [openingsAtSelection] = useState(openings);
  const [manualAttempt, setManualAttempt] = useState(0);
  const [rosterCheck, setRosterCheck] = useState<RosterCheck>();
  const [response, setResponse] = useState<{ attempt: number; revision: string; result: ScheduleSuggestionResult }>();
  const [focusChecks, setFocusChecks] = useState(0);
  const [expired, setExpired] = useState<string>();
  const attempt = manualAttempt || Number(openings > openingsAtSelection);
  const roster = rosterCheck?.attempt === manualAttempt && !saving ? rosterCheck : undefined;
  const revision = roster?.status === "staffed" ? roster.revision : undefined;
  const result = response?.attempt === attempt && response.revision === revision ? response.result : undefined;
  const needsRefresh = roster?.status === "staffed" && (roster.changed || !attempt);

  useEffect(() => {
    const recheck = () => setFocusChecks((count) => count + 1);
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, []);

  useEffect(() => {
    if (saving) return;
    const controller = new AbortController();

    async function checkRoster() {
      if (!isScheduleDate(date) || !locationId) throw new Error("Invalid selection");
      const assignments = supabaseClient
        ? await readSuggestionAssignments(supabaseClient, locationId, date, AbortSignal.any([
          controller.signal, AbortSignal.timeout(5000),
        ]))
        : overlappingAssignments(getMockDataStore().shifts.filter((shift) => shift.locationId === locationId), date);
      const revision = await scheduleRosterRevision(assignments);
      if (!controller.signal.aborted) {
        setRosterCheck((previous) => ({
          attempt: manualAttempt,
          status: assignments.length ? "staffed" : "empty",
          revision,
          changed: previous?.attempt === manualAttempt && previous.status !== "unavailable" &&
            (previous.changed || previous.revision !== revision),
        }));
      }
    }

    void checkRoster().catch(() => {
      if (!controller.signal.aborted) setRosterCheck({ attempt: manualAttempt, status: "unavailable" });
    });
    return () => controller.abort();
  }, [date, locationId, manualAttempt, saving, scheduleSync, focusChecks, openings]);

  useEffect(() => {
    if (!attempt || !revision || needsRefresh || result) return;
    const requestedRevision = revision;
    const controller = new AbortController();
    let pending = true;
    const unavailable = (retryable: boolean): ScheduleSuggestionResult =>
      ({ date, locationId, status: "unavailable", source: "schedule", retryable, rosterRevision: null });

    function saveResult(result: ScheduleSuggestionResult) {
      if (!controller.signal.aborted) setResponse({ attempt, revision: requestedRevision, result });
    }

    async function generate() {
      try {
        const res = await fetch("/api/schedule/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept-Language": lang },
          body: JSON.stringify({ date, locationId }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(26_000)]),
        });
        if (!res.ok) {
          saveResult(unavailable(res.status >= 500));
          return;
        }
        const result: ScheduleSuggestionResult = await res.json();
        if (controller.signal.aborted) return;
        if (result.date !== date || result.locationId !== locationId) {
          console.info("[schedule-suggestions] discarded stale selection");
          saveResult(unavailable(true));
          return;
        }
        if (result.status === "empty") {
          setRosterCheck({ attempt: manualAttempt, status: "empty", revision: result.rosterRevision, changed: true });
          return;
        }
        if (result.rosterRevision && result.rosterRevision !== requestedRevision) {
          console.info("[schedule-suggestions] discarded stale roster");
          setFocusChecks((count) => count + 1);
          saveResult(unavailable(true));
          return;
        }
        saveResult(result);
      } catch {
        saveResult(unavailable(true));
      } finally {
        pending = false;
      }
    }

    void generate();
    return () => {
      if (pending) console.info("[schedule-suggestions] discarded obsolete request");
      controller.abort();
    };
  }, [attempt, date, lang, locationId, manualAttempt, needsRefresh, result, revision]);

  const expiry = result?.status === "ready" ? result.expiresAt : undefined;
  useEffect(() => {
    if (!expiry) return;
    const timer = window.setTimeout(() => setExpired(expiry), Math.max(0, Date.parse(expiry) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiry]);

  const empty = roster?.status === "empty";
  const refresh = (label: string) => (
    <Button size="sm" variant="outline" className="mt-2" onClick={() => setManualAttempt((value) => value + 2)}>
      {label}
    </Button>
  );

  return (
    <div id="staffing-suggestion" hidden={!open && !empty} className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
      <div role="status">
        {empty ? t.empty : saving ? t.saving : !roster ? t.loading
          : roster.status === "unavailable" ? t.schedule
          : needsRefresh ? null
          : result?.status === "unavailable" ? t[result.source]
          : !result ? t.generating : null}
      </div>
      {open && roster?.status === "unavailable" && locationId && isScheduleDate(date) && refresh(t.retry)}
      {!empty && open && roster?.status === "staffed" && (
        <>
          {!needsRefresh && result?.status === "unavailable" && result.retryable && refresh(t.retry)}
          {(needsRefresh || (expiry && expiry === expired)) && refresh(t.refresh)}
          {!needsRefresh && result?.status === "ready" && expiry !== expired && (
            <>
              <p className="font-semibold text-slate-800">{result.date}</p>
              <ul className="mt-2 divide-y divide-slate-200">
                {result.suggestions.map((suggestion) => (
                  <li key={suggestion.startTime} className="py-2">
                    <p className="font-semibold text-slate-800">
                      {suggestion.startTime}–{suggestion.endTime} · {suggestion.scheduledHeadcount} {t.scheduled} · {t[suggestion.action]}{suggestion.count ? ` ${suggestion.count}` : ""}
                    </p>
                    <p className="mt-1">{suggestion.rationale}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

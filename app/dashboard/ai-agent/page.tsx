"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, format, getISOWeek, setISOWeek, setISOWeekYear, startOfWeek } from "date-fns";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  getEmployees,
  getShiftsByWeek,
  createShift,
  isSupabaseConfigured,
} from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";
import { toast } from "sonner";

type GeneratedShift = {
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  createdByAi: true;
};

type GenerationResult = {
  explanation: string;
  warnings: string[];
  shifts: GeneratedShift[];
};

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";

const COPY = {
  en: {
    title: "AI Schedule Generator",
    subtitle:
      "Describe staffing needs in natural language. The AI drafts a weekly schedule you can review before applying.",
    placeholder:
      "Example: Build next week's schedule. Strong lunch rush Tue-Fri, extra manager coverage Saturday evening.",
    generate: "Generate Schedule",
    regenerate: "Regenerate",
    apply: "Apply to Schedule",
    applying: "Applying...",
    generated: "Generated Draft",
    explanation: "AI Explanation",
    warnings: "Warnings",
    hours: "Hour Impact",
    overLimit: "Over max",
    withinLimit: "Within max",
    noShifts: "No shifts generated yet.",
    loading: "Loading employees and shifts...",
    loadError: "Failed to load employees/shifts for AI generation.",
    genError: "Failed to generate schedule.",
    applyError: "Failed to apply generated shifts.",
    applySuccess: "AI draft applied to schedule as draft shifts.",
    notConfigured:
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    anthropicMissing:
      "AI API is unavailable. Set ANTHROPIC_API_KEY in your environment.",
    week: "Week",
    dayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    examples: [
      "Schedule next week. Extra busy Saturday night. Keep part-timers under 20h.",
      "Need stronger lunch staffing Mon-Fri. Keep Sunday light and avoid overtime.",
      "Balance shifts fairly across all staff. Keep one manager every evening.",
    ],
  },
  sv: {
    title: "AI Schemagenerator",
    subtitle:
      "Beskriv bemanningsbehov med vanlig text. AI skapar ett veckoutkast som du kan granska innan du sparar.",
    placeholder:
      "Exempel: Skapa schema för nästa vecka. Hög lunchbelastning tis-fre, extra chefstäckning lördag kväll.",
    generate: "Generera schema",
    regenerate: "Generera igen",
    apply: "Applicera i schema",
    applying: "Sparar...",
    generated: "Genererat utkast",
    explanation: "AI-förklaring",
    warnings: "Varningar",
    hours: "Timpåverkan",
    overLimit: "Över max",
    withinLimit: "Inom max",
    noShifts: "Inga pass har genererats än.",
    loading: "Laddar anställda och pass...",
    loadError: "Kunde inte ladda anställda/pass för AI-generering.",
    genError: "Kunde inte generera schema.",
    applyError: "Kunde inte spara AI-pass.",
    applySuccess: "AI-utkast sparades i schemat som utkastpass.",
    notConfigured:
      "Supabase är inte konfigurerad. Lägg till NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local.",
    anthropicMissing:
      "AI-API är inte tillgängligt. Sätt ANTHROPIC_API_KEY i miljön.",
    week: "Vecka",
    dayNames: ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"],
    examples: [
      "Schemalägg nästa vecka. Extra fullt lördag kväll. Håll deltid under 20 timmar.",
      "Behöver starkare lunchbemanning mån-fre. Håll söndag lätt och undvik övertid.",
      "Fördela passen rättvist mellan personalen. Ha minst en chef varje kväll.",
    ],
  },
} as const;

function parseWeekParam(weekParam: string | null): Date {
  const match = weekParam?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeek(new Date(), { weekStartsOn: 1 });
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const yearAdjusted = setISOWeekYear(new Date(), year);
  const weekAdjusted = setISOWeek(yearAdjusted, week);
  return startOfWeek(weekAdjusted, { weekStartsOn: 1 });
}

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

function roleChipClass(role: string): string {
  switch (role) {
    case "grill":
      return "bg-[#e8b84b]/20 text-[#e8b84b] border-[#e8b84b]/50";
    case "counter":
      return "bg-sky-500/20 text-sky-300 border-sky-500/50";
    case "manager":
      return "bg-purple-500/20 text-purple-300 border-purple-500/50";
    case "cashier":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
    case "cleaner":
      return "bg-slate-500/20 text-slate-300 border-slate-500/50";
    case "service":
      return "bg-sky-500/20 text-sky-300 border-sky-500/50";
    case "shiftleader":
      return "bg-[#e8b84b]/20 text-[#e8b84b] border-[#e8b84b]/50";
    case "rutin":
      return "bg-purple-500/20 text-purple-300 border-purple-500/50";
    default:
      return "bg-zinc-600/25 text-zinc-200 border-zinc-500/50";
  }
}

export default function DashboardAiAgentPage() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const weekStart = useMemo(
    () => parseWeekParam(searchParams.get("week")),
    [searchParams]
  );

  const text = COPY[lang];
  const [prompt, setPrompt] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingShifts, setExistingShifts] = useState<Shift[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured) {
        setLoadingData(false);
        return;
      }
      try {
        setLoadingData(true);
        const [employeeRows, schedule] = await Promise.all([
          getEmployees(),
          getShiftsByWeek(weekStart, LOCATION_ID),
        ]);
        if (!active) return;
        setEmployees(employeeRows);
        setExistingShifts(schedule.shifts);
      } catch (loadErr) {
        console.error(loadErr);
        if (!active) return;
        setError(text.loadError);
      } finally {
        if (active) setLoadingData(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [weekStart, text.loadError]);

  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dayOrder = useMemo(
    () => dayDates.map((d) => format(d, "yyyy-MM-dd")),
    [dayDates]
  );

  const groupedGenerated = useMemo(() => {
    const map: Record<string, GeneratedShift[]> = {};
    for (const day of dayOrder) map[day] = [];
    for (const shift of result?.shifts ?? []) {
      if (!map[shift.date]) map[shift.date] = [];
      map[shift.date].push(shift);
    }
    return map;
  }, [dayOrder, result]);

  const hourImpact = useMemo(() => {
    const currentByEmployee = new Map<string, number>();
    for (const shift of existingShifts) {
      currentByEmployee.set(
        shift.employeeId,
        (currentByEmployee.get(shift.employeeId) ?? 0) +
          shiftHours(shift.startTime, shift.endTime)
      );
    }

    const generatedByEmployee = new Map<string, number>();
    for (const shift of result?.shifts ?? []) {
      generatedByEmployee.set(
        shift.employeeId,
        (generatedByEmployee.get(shift.employeeId) ?? 0) +
          shiftHours(shift.startTime, shift.endTime)
      );
    }

    return employees.map((emp) => {
      const current = currentByEmployee.get(emp.id) ?? 0;
      const generated = generatedByEmployee.get(emp.id) ?? 0;
      const projected = current + generated;
      return {
        id: emp.id,
        name: emp.name,
        max: emp.maxWeeklyHours,
        current,
        generated,
        projected,
        exceeds: projected > emp.maxWeeklyHours,
      };
    });
  }, [employees, existingShifts, result]);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setError(null);
    setSuccess(null);
    setGenerating(true);
    try {
      const employeePayload = employees.map((emp) => {
        const current = existingShifts
          .filter((s) => s.employeeId === emp.id)
          .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);
        return {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          maxWeeklyHours: emp.maxWeeklyHours,
          contractHours: emp.contractHours,
          currentScheduledHours: Number(current.toFixed(2)),
        };
      });

      const response = await fetch("/api/generate-schedule", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          employees: employeePayload,
          existingShifts: existingShifts.map((s) => ({
            employeeId: s.employeeId,
            employeeName: s.employeeName,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            role: s.role,
          })),
          weekStart: format(weekStart, "yyyy-MM-dd"),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const apiError =
          typeof payload?.error === "string" ? payload.error : text.genError;
        throw new Error(apiError);
      }

      const normalizedShifts: GeneratedShift[] = Array.isArray(payload?.shifts)
        ? payload.shifts.map((shift: GeneratedShift) => ({
            ...shift,
            employeeName:
              shift.employeeName ||
              employees.find((emp) => emp.id === shift.employeeId)?.name ||
              "",
          }))
        : [];

      setResult({
        explanation:
          typeof payload?.explanation === "string" ? payload.explanation : "",
        warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
        shifts: normalizedShifts,
      });

      const generatedByEmployee = new Map<string, number>();
      normalizedShifts.forEach((shift) => {
        generatedByEmployee.set(
          shift.employeeId,
          (generatedByEmployee.get(shift.employeeId) ?? 0) +
            shiftHours(shift.startTime, shift.endTime)
        );
      });
      const hasViolation = employees.some((employee) => {
        const existing = existingShifts
          .filter((shift) => shift.employeeId === employee.id)
          .reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
        const generated = generatedByEmployee.get(employee.id) ?? 0;
        return existing + generated > employee.maxWeeklyHours;
      });
      if (hasViolation) {
        toast.warning("AI detected hour violations");
      }
    } catch (genErr) {
      console.error(genErr);
      const msg = genErr instanceof Error ? genErr.message : text.genError;
      setError(msg);
      toast.error("Failed to save — try again");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApply() {
    if (!result?.shifts.length || !isSupabaseConfigured) return;
    setError(null);
    setSuccess(null);
    setApplying(true);
    try {
      for (const shift of result.shifts) {
        const employee = employees.find((emp) => emp.id === shift.employeeId);
        const locationId = employee?.locationId || LOCATION_ID;
        await createShift({
          employeeId: shift.employeeId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          role: shift.role,
          locationId,
          status: "draft",
          createdByAi: true,
        });
      }
      setSuccess(text.applySuccess);
      toast.success("Shift added");
    } catch (applyErr) {
      console.error(applyErr);
      setError(text.applyError);
      toast.error("Failed to save — try again");
    } finally {
      setApplying(false);
    }
  }

  const weekLabel = `${text.week} ${getISOWeek(weekStart)} • ${format(weekStart, "d MMM")}–${format(addDays(weekStart, 6), "d MMM")}`;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mb-4">
          <h2 className="font-mono text-lg text-[#f0f0f0]">{text.title}</h2>
          <p className="mt-1 text-sm text-[#8f8f8f]">{text.subtitle}</p>
          <p className="mt-2 text-xs font-mono tracking-wide text-[#6f6f6f]">
            {weekLabel}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            {text.notConfigured}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={text.placeholder}
          className="h-36 w-full resize-y rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3 text-sm text-[#f0f0f0] outline-none ring-0 placeholder:text-[#666] focus:border-[#e8b84b]/60"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {text.examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="rounded-full border border-[#2a2a2a] bg-[#151515] px-3 py-1.5 text-xs text-[#cfcfcf] hover:border-[#e8b84b]/50 hover:text-[#f0f0f0]"
            >
              {example}
            </button>
          ))}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || loadingData || !prompt.trim() || !isSupabaseConfigured}
          className="mt-4 h-10 w-full bg-[#e8b84b] font-semibold text-black hover:bg-[#f0c75c]"
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {text.generate}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {text.generate}
            </>
          )}
        </Button>

        {loadingData && (
          <div className="mt-3 text-xs text-[#888]">{text.loading}</div>
        )}
      </section>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error.includes("ANTHROPIC_API_KEY") ? text.anthropicMissing : error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <section className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-mono text-sm uppercase tracking-wide text-[#9f9f9f]">
            {text.generated}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
            >
              {text.regenerate}
            </Button>
            <Button
              size="sm"
              className="bg-[#e8b84b] text-black hover:bg-[#f0c75c]"
              onClick={handleApply}
              disabled={applying || !result?.shifts?.length || !isSupabaseConfigured}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {text.applying}
                </>
              ) : (
                text.apply
              )}
            </Button>
          </div>
        </div>

        {result?.explanation && (
          <div className="mb-4 rounded-lg border border-[#2a2a2a] bg-[#131313] p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-[#888]">
              {text.explanation}
            </div>
            <p className="text-sm text-[#d0d0d0]">{result.explanation}</p>
          </div>
        )}

        {!!result?.warnings?.length && (
          <div className="mb-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-[#888]">
              {text.warnings}
            </div>
            {result.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-200"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {result?.shifts?.length ? (
          <div className="space-y-2">
            {dayOrder.map((day, index) => {
              const dayShifts = groupedGenerated[day] ?? [];
              return (
                <div
                  key={day}
                  className="flex min-h-[52px] items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-2"
                >
                  <div className="w-24 shrink-0 font-mono text-xs text-[#888]">
                    {text.dayNames[index]}
                  </div>
                  <div className="w-24 shrink-0 font-mono text-sm text-[#f0f0f0]">
                    {format(dayDates[index], "d MMM")}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {dayShifts.length ? (
                      dayShifts.map((shift, idx) => (
                        <div
                          key={`${shift.employeeId}-${shift.date}-${shift.startTime}-${idx}`}
                          className={`${roleChipClass(shift.role)} flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium`}
                          title={`${shift.employeeName} • ${shift.role}`}
                        >
                          <Sparkles className="h-3 w-3 shrink-0 opacity-80" />
                          <span className="truncate">
                            {shift.employeeName} • {shift.startTime}–{shift.endTime}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-[#666]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[#2a2a2a] bg-[#121212] px-4 py-8 text-center text-sm text-[#777]">
            {text.noShifts}
          </div>
        )}

        <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#131313] p-3">
          <div className="mb-3 text-xs uppercase tracking-wide text-[#888]">
            {text.hours}
          </div>
          <div className="space-y-2">
            {hourImpact.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-[#d7d7d7]">{row.name}</span>
                <span
                  className={`font-mono ${row.exceeds ? "text-red-400" : "text-emerald-400"}`}
                >
                  {row.projected.toFixed(1)}h / {row.max}h
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#8a8a8a]">
            <span>{text.withinLimit}</span>
            <span>{text.overLimit}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

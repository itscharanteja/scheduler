"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, format, getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear, startOfWeek } from "date-fns";
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sparkles, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useAIAgent } from "@/hooks/use-ai-agent";

type ResultShift = NonNullable<ReturnType<typeof useAIAgent>["result"]>["shifts"][number];

function parseWeekParam(weekParam: string | null): Date {
  const match = weekParam?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeek(new Date(), { weekStartsOn: 1 });
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  return startOfWeek(setISOWeek(setISOWeekYear(new Date(), year), week), { weekStartsOn: 1 });
}

function toWeekParam(date: Date): string {
  return `${getISOWeekYear(date)}-W${getISOWeek(date).toString().padStart(2, "0")}`;
}

function DashboardAiAgentContent() {
  const { lang } = useLanguage();
  const { locationId } = useLocation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const weekStart = useMemo(
    () => parseWeekParam(searchParams.get("week")),
    [searchParams]
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  function handlePrevWeek() {
    const next = addDays(weekStart, -7);
    router.push(`/ai-agent?week=${toWeekParam(next)}`);
  }

  function handleNextWeek() {
    const next = addDays(weekStart, 7);
    router.push(`/ai-agent?week=${toWeekParam(next)}`);
  }

  function handleCurrentWeek() {
    const today = startOfWeek(new Date(), { weekStartsOn: 1 });
    router.push(`/ai-agent?week=${toWeekParam(today)}`);
  }

  const copy =
    lang === "sv"
      ? {
          placeholder: "Beskriv vad som behöver förbättras i bemanningen...",
          generate: "Generera förslag",
          regenerate: "Generera igen",
          apply: "Godkänn förslag",
          applying: "Sparar...",
          recommendations: "Rekommendationer",
          explanation: "Varför AI föreslår detta",
          warnings: "Risker och kontroller",
          impact: "Effekt per person",
          noShifts: "Inga AI-pass ännu. Skriv en tydlig instruktion för att få ett konkret förslag.",
          approve: "Godkänn",
          reject: "Rensa",
          source: "Källsignaler",
        }
      : {
          placeholder: "Describe what needs to improve in staffing...",
          generate: "Generate recommendation",
          regenerate: "Generate again",
          apply: "Approve recommendation",
          applying: "Applying...",
          recommendations: "Recommendations",
          explanation: "Why AI recommends this",
          warnings: "Risks and checks",
          impact: "Impact per person",
          noShifts: "No AI shifts yet. Write a clear instruction to get an actionable recommendation.",
          approve: "Approve",
          reject: "Clear",
          source: "Source signals",
        };

  const {
    prompt,
    setPrompt,
    result,
    loadingData,
    generating,
    applying,
    error,
    success,
    hourImpact,
    generate,
    applyGenerated,
    isSupabaseConfigured,
  } = useAIAgent({ weekStart, locationId });

  const totalScheduledHours = useMemo(
    () => hourImpact.reduce((sum, r) => sum + r.current, 0),
    [hourImpact]
  );
  const totalProposedHours = useMemo(
    () => hourImpact.reduce((sum, r) => sum + r.generated, 0),
    [hourImpact]
  );
  const scheduledEmployeesCount = useMemo(
    () => hourImpact.filter((r) => r.current > 0).length,
    [hourImpact]
  );

  async function handleApply() {
    const weekParam = await applyGenerated();
    if (weekParam) {
      router.push(`/schedule?week=${weekParam}`);
    }
  }

  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const groupedShifts = useMemo(() => {
    const byDay = new Map<string, ResultShift[]>();
    for (const shift of result?.shifts ?? []) {
      const existing = byDay.get(shift.date) ?? [];
      existing.push(shift);
      byDay.set(shift.date, existing);
    }
    return byDay;
  }, [result?.shifts]);

  const seedExamples = lang === "sv"
    ? [
        "Behöver starkare täckning 18:00-20:00 fredag och lördag.",
        "Håll deltidspersonal under kontrakt men säkra lunchrush mån-fre.",
        "Minska övertid och täck middagsrush med en extra serviceperson.",
      ]
    : [
        "Need stronger coverage 18:00-20:00 on Friday and Saturday.",
        "Keep part-time staff under contract but protect lunch rush Mon-Fri.",
        "Reduce overtime and cover dinner rush with one extra service teammate.",
      ];

  return (
    <div className="space-y-4">
      {/* Week Navigator Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-600 hover:text-slate-900"
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCurrentWeek}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-md transition-colors"
            >
              {lang === "sv" ? "Denna vecka" : "This Week"}
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-600 hover:text-slate-900"
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div>
            <div className="text-sm font-bold text-slate-900">
              {lang === "sv" ? `Vecka ${getISOWeek(weekStart)}` : `Week ${getISOWeek(weekStart)}`}
              <span className="ml-2 text-xs font-medium text-slate-500">
                ({format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")})
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {scheduledEmployeesCount} {lang === "sv" ? "anställda schemalagda" : "employees scheduled"} • {totalScheduledHours.toFixed(1)}h {lang === "sv" ? "totalt" : "total"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/schedule?week=${toWeekParam(weekStart)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {lang === "sv" ? "Visa schemat" : "View Schedule"} →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-4">
          <div className="app-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{copy.recommendations}</h2>
                <p className="section-copy">
                  {lang === "sv"
                    ? `Vecka ${getISOWeek(weekStart)} • AI-förslag ska vara tydliga, begripliga och redo för godkännande.`
                    : `Week ${getISOWeek(weekStart)} • AI suggestions should be clear, understandable, and ready to approve.`}
                </p>
              </div>
              <span className="status-chip status-info">
                <Bot className="h-3.5 w-3.5" />
                AI
              </span>
            </div>

            {!isSupabaseConfigured ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Supabase is not configured. AI can still draft, but applying shifts is disabled.
              </div>
            ) : null}

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={copy.placeholder}
              className="mt-4 min-h-[140px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {seedExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="status-chip status-neutral"
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button onClick={() => generate()} disabled={generating || loadingData || !prompt.trim()}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {result ? copy.regenerate : copy.generate}
              </Button>
              <Button variant="outline" onClick={() => void handleApply()} disabled={applying || !result?.shifts.length || !isSupabaseConfigured}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {applying ? copy.applying : copy.apply}
              </Button>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p>{success}</p>
                <Link
                  href={`/schedule?week=${toWeekParam(weekStart)}`}
                  className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-75"
                >
                  View schedule →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="app-panel p-5">
            <h3 className="section-title">{copy.recommendations}</h3>
            <div className="mt-4 list-block">
              {result?.shifts?.length ? (
                dayDates.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayShifts = groupedShifts.get(dayKey) ?? [];
                  return (
                    <div key={dayKey} className="list-row">
                      <div className="list-row-main">
                        <div className="list-row-title">{format(day, "EEEE d MMM")}</div>
                        <div className="list-row-copy">
                          {dayShifts.length
                            ? dayShifts.map((shift) => `${shift.employeeName} ${shift.startTime}-${shift.endTime}`).join(" • ")
                            : "No AI action"}
                        </div>
                      </div>
                      {dayShifts.length ? (
                        <span className="status-chip status-info">{dayShifts.length}</span>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="app-panel-muted px-4 py-10 text-center text-sm text-slate-600">{copy.noShifts}</div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="app-panel p-5">
            <h3 className="section-title">{copy.explanation}</h3>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              {result?.explanation || "AI will explain which hours are at risk, what it changed, and why those changes matter."}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="list-row surface-info">
                <div className="list-row-main">
                  <div className="list-row-title">{copy.source}</div>
                  <div className="list-row-copy">Sales history, shift mix, weekly pattern</div>
                </div>
              </div>
              <div className="list-row surface-info">
                <div className="list-row-main">
                  <div className="list-row-title">Rule checks</div>
                  <div className="list-row-copy">Contract hours, rest gaps, coverage windows</div>
                </div>
              </div>
            </div>
          </div>

          <div className="app-panel p-5">
            <h3 className="section-title">{copy.warnings}</h3>
            <div className="mt-4 list-block">
              {result?.warnings?.length ? (
                result.warnings.map((warning) => (
                  <div key={warning} className="list-row surface-warning">
                    <div className="list-row-main">
                      <div className="flex items-center gap-2">
                        <TriangleAlert className="h-4 w-4 text-amber-600" />
                        <div className="list-row-title">{warning}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="list-row">
                  <div className="list-row-main">
                    <div className="list-row-title">No rule warnings yet</div>
                    <div className="list-row-copy">Generated recommendations will show risks here before approval.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="app-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="section-title">{copy.impact}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === "sv"
                    ? `${scheduledEmployeesCount} av ${hourImpact.length} anställda schemalagda (${totalScheduledHours.toFixed(1)}h)`
                    : `${scheduledEmployeesCount} of ${hourImpact.length} staff scheduled (${totalScheduledHours.toFixed(1)}h total)`}
                  {totalProposedHours > 0 ? ` • +${totalProposedHours.toFixed(1)}h ${lang === "sv" ? "föreslagna" : "proposed"}` : ""}
                </p>
              </div>
              <div className="toolbar-row">
                <Button size="sm" variant="outline" onClick={() => setPrompt("")}>
                  <XCircle className="h-4 w-4" />
                  {copy.reject}
                </Button>
                <Button size="sm" onClick={() => void handleApply()} disabled={applying || !result?.shifts?.length || !isSupabaseConfigured}>
                  <CheckCircle2 className="h-4 w-4" />
                  {copy.approve}
                </Button>
              </div>
            </div>

            <div className="mt-4 list-block max-h-[480px] overflow-y-auto divide-y divide-slate-100">
              {hourImpact.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  {lang === "sv" ? "Inga anställda hittades." : "No employees found."}
                </div>
              ) : (
                hourImpact.map((row) => (
                  <div key={row.id} className="list-row hover:bg-slate-50/80 transition-colors py-2.5">
                    <div className="list-row-main">
                      <div className="flex items-center gap-2">
                        <span className="list-row-title text-slate-900 font-semibold">{row.name}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                          {row.role}
                        </span>
                      </div>
                      <div className="list-row-copy flex items-center gap-2 flex-wrap mt-0.5 text-xs">
                        <span className={row.current > 0 ? "font-semibold text-slate-800" : "text-slate-400"}>
                          {lang === "sv" ? "Nuvarande" : "Current"}: {row.current.toFixed(1)}h {row.shiftCount > 0 ? `(${row.shiftCount} ${lang === "sv" ? "pass" : "shifts"})` : ""}
                        </span>
                        {row.generated > 0 && (
                          <span className="font-semibold text-blue-600">
                            • {lang === "sv" ? "Förslag" : "Proposed"}: +{row.generated.toFixed(1)}h
                          </span>
                        )}
                        <span className="text-slate-400">
                          • {lang === "sv" ? "Kontrakt" : "Contract"}: {row.contractHours}h
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-chip ${row.exceeds ? "status-danger" : row.current > 0 ? "status-success" : "status-neutral"}`}>
                        {row.projected.toFixed(1)} / {row.max}h
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardAiAgentPage() {
  const { hasRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !hasRole("admin", "super_admin")) {
      router.replace("/");
    }
  }, [loading, hasRole, router]);

  if (loading || !hasRole("admin", "super_admin")) return null;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardAiAgentContent />
    </Suspense>
  );
}

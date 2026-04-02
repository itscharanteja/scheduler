"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, format, getISOWeek, setISOWeek, setISOWeekYear, startOfWeek } from "date-fns";
import { Bot, CheckCircle2, Loader2, Sparkles, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { useAIAgent } from "@/hooks/use-ai-agent";

type ResultShift = NonNullable<ReturnType<typeof useAIAgent>["result"]>["shifts"][number];

function parseWeekParam(weekParam: string | null): Date {
  const match = weekParam?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeek(new Date(), { weekStartsOn: 1 });
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const yearAdjusted = setISOWeekYear(new Date(), year);
  const weekAdjusted = setISOWeek(yearAdjusted, week);
  return startOfWeek(weekAdjusted, { weekStartsOn: 1 });
}

function DashboardAiAgentContent() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const weekStart = useMemo(
    () => parseWeekParam(searchParams.get("week")),
    [searchParams]
  );

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
          approve: "Approve",
          reject: "Reject",
          source: "Source signals",
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
          reject: "Reject",
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
  } = useAIAgent({ weekStart });

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
            <Button variant="outline" onClick={applyGenerated} disabled={applying || !result?.shifts.length || !isSupabaseConfigured}>
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
              {success}
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
            <h3 className="section-title">{copy.impact}</h3>
            <div className="toolbar-row">
              <Button size="sm" variant="outline">
                <XCircle className="h-4 w-4" />
                {copy.reject}
              </Button>
              <Button size="sm" onClick={applyGenerated} disabled={applying || !result?.shifts?.length || !isSupabaseConfigured}>
                <CheckCircle2 className="h-4 w-4" />
                {copy.approve}
              </Button>
            </div>
          </div>
          <div className="mt-4 list-block">
            {hourImpact.map((row) => (
              <div key={row.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{row.name}</div>
                  <div className="list-row-copy">
                    Current {row.current.toFixed(1)}h • Proposed +{row.generated.toFixed(1)}h
                  </div>
                </div>
                <span className={`status-chip ${row.exceeds ? "status-danger" : "status-success"}`}>
                  {row.projected.toFixed(1)} / {row.max}h
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DashboardAiAgentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardAiAgentContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useRef, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  format,
  getISOWeek,
  setISOWeek,
  setISOWeekYear,
  startOfWeek,
} from "date-fns";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { useAIAgent } from "@/hooks/use-ai-agent";
import { getEmployees } from "@/lib/supabase";

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

function roleChipClass(role: string): string {
  switch (role) {
    case "service":
      return "bg-sky-100/80 text-sky-800 border-sky-300";
    case "shiftleader":
      return "bg-amber-100/80 text-amber-900 border-amber-300";
    case "rutin":
      return "bg-violet-100/80 text-violet-800 border-violet-300";
    default:
      return "bg-slate-100/80 text-slate-800 border-slate-300";
  }
}

function DashboardAiAgentContent() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const weekStart = useMemo(
    () => parseWeekParam(searchParams.get("week")),
    [searchParams],
  );
  const text = COPY[lang];

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

  // Note: useAIAgent loads employees internally, we'll get them from the hook's state
  // For now, we'll use a simpler approach with useMemo to extract employee names

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [employeesList, setEmployeesList] = useState<Array<{ id: string; name: string; role: string }>>([]);

  // Load employees on mount
  useEffect(() => {
    getEmployees()
      .then((emps) => {
        setEmployeesList(emps.map((e) => ({ id: e.id, name: e.name, role: e.role })));
      })
      .catch((err) => console.error("Failed to load employees for mentions:", err));
  }, []);

  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const dayOrder = useMemo(
    () => dayDates.map((day) => format(day, "yyyy-MM-dd")),
    [dayDates],
  );
  const groupedGenerated = useMemo(() => {
    const map: Record<string, NonNullable<typeof result>["shifts"]> = {};
    for (const day of dayOrder) map[day] = [];
    for (const shift of result?.shifts ?? []) {
      if (!map[shift.date]) map[shift.date] = [];
      map[shift.date].push(shift);
    }
    return map;
  }, [dayOrder, result]);

  const weekLabel = `${text.week} ${getISOWeek(weekStart)} • ${format(weekStart, "d MMM")}–${format(addDays(weekStart, 6), "d MMM")}`;

  // Filter employees based on mention search
  const filteredEmployees = useMemo(() => {
    if (!mentionSearch) return employeesList;
    return employeesList.filter((emp) =>
      emp.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [employeesList, mentionSearch]);

  // Handle textarea input and detect @ mentions
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);

    // Detect @ mention
    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const searchText = textBeforeCursor.substring(lastAtIndex + 1);
      // Only show mentions if we just typed @ or if the text after @ contains only valid characters
      if (/^[a-zA-Z0-9\s]*$/.test(searchText)) {
        setMentionSearch(searchText.trim());
        setShowMentions(true);

        // Calculate position for dropdown
        const lines = textBeforeCursor.split("\n");
        const currentLine = lines.length - 1;
        const lineStartPos = value.substring(0, cursorPos).lastIndexOf("\n") + 1;
        const lineText = value.substring(lineStartPos, cursorPos);

        // Approximate position (this is a rough estimate)
        setMentionPosition({
          top: currentLine * 24,
          left: Math.min(lineText.length * 8, 300),
        });
      }
    } else {
      setShowMentions(false);
      setMentionSearch("");
    }
  };

  // Handle selecting an employee mention
  const handleSelectEmployee = (employeeName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = prompt.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const newPrompt =
        prompt.substring(0, lastAtIndex) +
        `@${employeeName} ` +
        prompt.substring(cursorPos);

      setPrompt(newPrompt);
      setShowMentions(false);
      setMentionSearch("");

      // Move cursor after the mention
      setTimeout(() => {
        if (textarea) {
          const newPos = lastAtIndex + employeeName.length + 2;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
        }
      }, 0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="ai-intelligence-border">
        <section className="glass-ai-panel ai-intelligence-inner glass-interactive p-5">
          <div className="mb-4">
            <h2 className="font-mono text-lg text-slate-900">{text.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text.subtitle}</p>
            <p className="mt-2 text-xs font-mono tracking-wide text-slate-500">
              {weekLabel}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {text.notConfigured}
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handlePromptChange}
              placeholder={text.placeholder}
              className="h-36 w-full resize-y rounded-2xl border border-white/60 bg-white/70 p-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
            />

            {showMentions && filteredEmployees.length > 0 && (
              <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-300/60 bg-white/95 shadow-lg">
                {filteredEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => handleSelectEmployee(employee.name)}
                    className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100/80"
                  >
                    <span className="font-semibold">{employee.name}</span>
                    <span className="ml-2 text-xs text-slate-500">({employee.role})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {text.examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="glass-chip px-3 py-1.5 text-xs text-slate-800"
              >
                {example}
              </button>
            ))}
          </div>

          <Button
            onClick={() => generate()}
            disabled={
              generating ||
              loadingData ||
              !prompt.trim() ||
              !isSupabaseConfigured
            }
            className="mt-4 h-10 w-full glass-button font-semibold text-slate-900"
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
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.includes("ANTHROPIC_API_KEY") ? text.anthropicMissing : error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <section className="glass-ai-panel glass-interactive mt-8 space-y-4 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-mono text-sm uppercase tracking-wide text-slate-600">
            {text.generated}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="glass-button border-none bg-white/70 text-slate-900"
              onClick={() => generate()}
              disabled={generating || !prompt.trim()}
            >
              {text.regenerate}
            </Button>
            <Button
              size="sm"
              className="glass-button bg-white/80 text-slate-900"
              onClick={applyGenerated}
              disabled={
                applying || !result?.shifts?.length || !isSupabaseConfigured
              }
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
          <div className="mb-4 rounded-lg border border-white/70 bg-white/80 p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-600">
              {text.explanation}
            </div>
            <p className="text-sm text-slate-800">{result.explanation}</p>
          </div>
        )}

        {!!result?.warnings?.length && (
          <div className="mb-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-600">
              {text.warnings}
            </div>
            {result.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
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
                  className="rounded-lg border border-white/70 bg-white/85 p-3"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-20 shrink-0 font-mono text-sm font-semibold text-slate-700">
                      {text.dayNames[index]}
                    </div>
                    <div className="font-mono text-sm text-slate-600">
                      {format(dayDates[index], "d MMM")}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {dayShifts.length ? (
                      dayShifts.map((shift, idx) => (
                        <div
                          key={`${shift.employeeId}-${shift.date}-${shift.startTime}-${idx}`}
                          className={`${roleChipClass(shift.role)} inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold`}
                          title={`${shift.employeeName} • ${shift.role}`}
                        >
                          <Sparkles className="h-4 w-4 shrink-0" />
                          <span className="whitespace-nowrap">
                            {shift.employeeName} • {shift.startTime}–{shift.endTime}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">No shifts</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-600">
            {text.noShifts}
          </div>
        )}

        <div className="mt-5 rounded-lg border border-white/70 bg-white/80 p-3">
          <div className="mb-3 text-xs uppercase tracking-wide text-slate-600">
            {text.hours}
          </div>
          <div className="space-y-2">
            {hourImpact.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-slate-800">{row.name}</span>
                <span
                  className={`font-mono ${row.exceeds ? "text-red-500" : "text-emerald-600"}`}
                >
                  {row.projected.toFixed(1)}h / {row.max}h
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{text.withinLimit}</span>
            <span>{text.overLimit}</span>
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

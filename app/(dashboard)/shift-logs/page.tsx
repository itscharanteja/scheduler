"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Moon,
  Pencil,
  Plus,
  Save,
  Square,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOCATION_ID } from "@/lib/constants";
import {
  getChecklistTemplate,
  upsertChecklistTemplate,
  getChecklistSubmission,
  saveChecklistSubmission,
} from "@/lib/supabase";
import type { ChecklistTemplate, ChecklistSubmission } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChecklistShiftType = "morning" | "evening";

const CHECKLIST_SHIFTS: {
  value: ChecklistShiftType;
  label: string;
  labelSv: string;
  icon: typeof Sun;
}[] = [
  { value: "morning", label: "Morning shift", labelSv: "Morgonpass", icon: Sun },
  { value: "evening", label: "Evening shift", labelSv: "Kvällspass", icon: Moon },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── ChecklistPanel ───────────────────────────────────────────────────────────

function ChecklistPanel({
  shiftType,
  lang,
  canManage,
  employeeId,
}: {
  shiftType: ChecklistShiftType;
  lang: "en" | "sv";
  canManage: boolean;
  employeeId: string | null | undefined;
}) {
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [submission, setSubmission] = useState<ChecklistSubmission | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error">("loading");

  // manager edit state
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  // shift leader check state
  const [checked, setChecked] = useState<boolean[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const today = todayISO();
  const ShiftIcon = shiftType === "morning" ? Sun : Moon;
  const accentColor = shiftType === "morning" ? "text-amber-500" : "text-indigo-500";
  const accentBg = shiftType === "morning" ? "bg-amber-50" : "bg-indigo-50";
  const accentBorder = shiftType === "morning" ? "border-amber-200" : "border-indigo-200";
  const progressColor = shiftType === "morning" ? "bg-amber-400" : "bg-indigo-400";
  const progressStroke = shiftType === "morning" ? "#f59e0b" : "#6366f1";

  const shiftMeta = CHECKLIST_SHIFTS.find((s) => s.value === shiftType)!;
  const label = lang === "sv" ? shiftMeta.labelSv : shiftMeta.label;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingState("loading");
      try {
        const [tmpl, sub] = await Promise.all([
          getChecklistTemplate(LOCATION_ID, shiftType),
          getChecklistSubmission(LOCATION_ID, shiftType, today),
        ]);
        if (!active) return;
        setTemplate(tmpl);
        setDraftItems(tmpl?.items ?? []);
        const items = tmpl?.items ?? [];
        if (sub) {
          setChecked(items.map((_, i) => sub.checkedItems[i] ?? false));
          setSubmission(sub);
        } else {
          setChecked(items.map(() => false));
          setSubmission(null);
        }
        setLoadingState("ready");
      } catch {
        if (active) setLoadingState("error");
      }
    })();
    return () => { active = false; };
  }, [shiftType, today]);

  async function handleSaveTemplate() {
    if (saving) return;
    const cleaned = draftItems.map((i) => i.trim()).filter(Boolean);
    setSaving(true);
    const ok = await upsertChecklistTemplate(LOCATION_ID, shiftType, cleaned);
    setSaving(false);
    if (ok) {
      setTemplate((prev) =>
        prev
          ? { ...prev, items: cleaned }
          : { id: "", locationId: LOCATION_ID, shiftType, items: cleaned, updatedAt: new Date().toISOString() }
      );
      setDraftItems(cleaned);
      setChecked(cleaned.map((_, i) => submission?.checkedItems[i] ?? false));
      setEditing(false);
      toast.success(lang === "sv" ? "Mall sparad" : "Template saved");
    } else {
      toast.error(lang === "sv" ? "Kunde inte spara mallen" : "Failed to save template");
    }
  }

  async function handleToggle(idx: number) {
    if (!employeeId) {
      toast.error(lang === "sv" ? "Inget koppat medarbetarkonto" : "No linked employee account");
      return;
    }
    const next = checked.map((v, i) => (i === idx ? !v : v));
    setChecked(next);
    const allDone = next.every(Boolean) && next.length > 0;
    const saved = await saveChecklistSubmission(LOCATION_ID, shiftType, today, employeeId, next, allDone);
    if (saved) setSubmission(saved);
  }

  async function handleComplete() {
    if (!employeeId || submitting) return;
    const items = template?.items ?? [];
    const allChecked = items.map(() => true);
    setChecked(allChecked);
    setSubmitting(true);
    const saved = await saveChecklistSubmission(LOCATION_ID, shiftType, today, employeeId, allChecked, true);
    setSubmitting(false);
    if (saved) {
      setSubmission(saved);
      toast.success(lang === "sv" ? "Checklista slutförd!" : "Checklist completed!");
    } else {
      toast.error(lang === "sv" ? "Kunde inte spara" : "Failed to save");
    }
  }

  const items = template?.items ?? [];
  const checkedCount = checked.filter(Boolean).length;
  const isComplete = submission?.isComplete ?? false;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  const circumference = 2 * Math.PI * 11;

  if (loadingState === "loading") {
    return (
      <div className={cn("app-panel flex items-center justify-center py-12 border", accentBorder)}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className={cn("app-panel overflow-hidden border", accentBorder)}>
      {/* Header */}
      <div className={cn("flex items-center justify-between gap-3 px-5 py-4", accentBg)}>
        <div className="flex items-center gap-2.5">
          <ShiftIcon className={cn("h-4 w-4", accentColor)} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            {isComplete ? (
              <p className="text-xs font-medium text-emerald-600">
                {lang === "sv" ? "Slutförd idag" : "Completed today"}
              </p>
            ) : items.length > 0 ? (
              <p className="text-xs text-slate-500">
                {checkedCount}/{items.length} {lang === "sv" ? "avklarade" : "done"}
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                {lang === "sv" ? "Inga objekt ännu" : "No items yet"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isComplete ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          ) : items.length > 0 ? (
            <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <circle
                cx="14" cy="14" r="11" fill="none"
                stroke={progressStroke}
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress / 100)}
                strokeLinecap="round"
              />
            </svg>
          ) : null}

          {canManage && !editing && (
            <button
              type="button"
              onClick={() => { setEditing(true); setDraftItems(items); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-700"
              title={lang === "sv" ? "Redigera mall" : "Edit template"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canManage && editing && (
            <button
              type="button"
              onClick={() => { setEditing(false); setDraftItems(items); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Manager: template editor */}
      {editing && canManage && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {lang === "sv" ? "Redigera checklistobjekt" : "Edit checklist items"}
          </p>
          <ul className="space-y-2">
            {draftItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input
                  value={item}
                  onChange={(e) =>
                    setDraftItems((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                  className="flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setDraftItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={lang === "sv" ? "Nytt objekt..." : "New item..."}
              className="flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim()) {
                  e.preventDefault();
                  setDraftItems((prev) => [...prev, newItem.trim()]);
                  setNewItem("");
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (newItem.trim()) {
                  setDraftItems((prev) => [...prev, newItem.trim()]);
                  setNewItem("");
                }
              }}
              disabled={!newItem.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button onClick={() => void handleSaveTemplate()} disabled={saving} size="sm" className="w-full gap-2">
            <Save className="h-3.5 w-3.5" />
            {saving
              ? lang === "sv" ? "Sparar..." : "Saving..."
              : lang === "sv" ? "Spara mall" : "Save template"}
          </Button>
        </div>
      )}

      {/* Checklist items */}
      {!editing && (
        <div className="divide-y divide-slate-50">
          {items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">
                {canManage
                  ? lang === "sv"
                    ? "Inga objekt. Klicka på pennan för att lägga till."
                    : "No items yet. Click the pencil to add some."
                  : lang === "sv"
                    ? "Ingen checklista skapad av chefen ännu."
                    : "No checklist created by the manager yet."}
              </p>
            </div>
          ) : (
            <>
              {items.map((item, i) => {
                const done = checked[i] ?? false;
                const canCheck = !isComplete && !!employeeId;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!canCheck}
                    onClick={() => { if (canCheck) void handleToggle(i); }}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors",
                      canCheck ? "cursor-pointer hover:bg-slate-50/60" : "cursor-default",
                      done && "opacity-60"
                    )}
                  >
                    {done ? (
                      <CheckSquare className={cn("h-4 w-4 shrink-0", accentColor)} />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className={cn("text-sm text-slate-800", done && "line-through text-slate-400")}>
                      {item}
                    </span>
                  </button>
                );
              })}

              <div className="px-5 py-4 space-y-3">
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={cn("h-1.5 rounded-full transition-all duration-300", progressColor)}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {isComplete ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {lang === "sv" ? "Checklistan slutförd" : "Checklist complete"}
                  </div>
                ) : (
                  !canManage && employeeId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={submitting || checkedCount === 0}
                      onClick={() => void handleComplete()}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {lang === "sv" ? "Markera alla som klara" : "Mark all complete"}
                    </Button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShiftLogsPage() {
  const { lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const canManage = hasRole("admin", "super_admin");

  const t = lang === "sv"
    ? {
        checklists: "Skiftchecklistor",
        checklistsDesc: "Varje skiftstart genereras en ny checklista från mallen. Skiftledaren bockar av och stänger.",
      }
    : {
        checklists: "Shift Checklists",
        checklistsDesc: "A fresh checklist is generated from the template each shift. The shift leader ticks off and closes it.",
      };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h2 className="section-title">{t.checklists}</h2>
          <p className="section-copy">{t.checklistsDesc}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ChecklistPanel
            shiftType="morning"
            lang={lang}
            canManage={canManage}
            employeeId={user?.employeeId}
          />
          <ChecklistPanel
            shiftType="evening"
            lang={lang}
            canManage={canManage}
            employeeId={user?.employeeId}
          />
        </div>
      </section>
    </div>
  );
}

"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  getShiftsByWeek,
  getEmployees,
  createShift,
  updateShift,
  deleteShift,
  isSupabaseConfigured,
  type CreateShiftInput,
} from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";
import {
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
  startOfWeek,
} from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  i.toString().padStart(2, "0")
);
const PERIOD_OPTIONS = ["AM", "PM"] as const;

const DAY_KEYS = [
  "schedule.day.mon",
  "schedule.day.tue",
  "schedule.day.wed",
  "schedule.day.thu",
  "schedule.day.fri",
  "schedule.day.sat",
  "schedule.day.sun",
] as const;

function parseWeekParam(weekParam: string | null): Date {
  const match = weekParam?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeek(new Date(), { weekStartsOn: 1 });
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const withYear = setISOWeekYear(new Date(), year);
  const withWeek = setISOWeek(withYear, week);
  return startOfWeek(withWeek, { weekStartsOn: 1 });
}

function toWeekParam(date: Date): string {
  const y = getISOWeekYear(date);
  const w = getISOWeek(date);
  return `${y}-W${w.toString().padStart(2, "0")}`;
}

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

type Period = (typeof PERIOD_OPTIONS)[number];

function to12hParts(time24: string): { hour: string; minute: string; period: Period } {
  const [h, m] = time24.split(":").map(Number);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return { hour: "10", minute: "00", period: "AM" };
  }
  const period: Period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return {
    hour: hour12.toString().padStart(2, "0"),
    minute: m.toString().padStart(2, "0"),
    period,
  };
}

function from12hParts(hour: string, minute: string, period: Period): string {
  const h = Number.parseInt(hour, 10);
  const m = Number.parseInt(minute, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) {
    return "10:00";
  }
  let hour24 = h % 12;
  if (period === "PM") hour24 += 12;
  return `${hour24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function roleChipClass(role: string): string {
  switch (role) {
    case "service":
      return "bg-sky-500/25 text-sky-200 border-sky-500/50";
    case "shiftleader":
      return "bg-amber-500/25 text-amber-200 border-amber-500/50";
    case "rutin":
      return "bg-purple-500/25 text-purple-200 border-purple-500/50";
    default:
      return "bg-slate-500/25 text-slate-200 border-slate-500/50";
  }
}

type ShiftFormState = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  notes: string;
  publishNow: boolean;
};

const emptyShiftForm: ShiftFormState = {
  employeeId: "",
  date: "",
  startTime: "10:00",
  endTime: "18:00",
  role: "service",
  notes: "",
  publishNow: false,
};

export default function ScheduleDashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");
  const weekStart = useMemo(
    () => parseWeekParam(weekParam),
    [weekParam]
  );

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDay, setAddModalDay] = useState<string>("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftFormState>(emptyShiftForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calendarDate, setCalendarDate] = useState("");

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekLabel = `${format(weekStart, "d MMM")}–${format(weekEnd, "d MMM")}`;
  const weekNumber = getISOWeek(weekStart);

  const setWeekParam = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("week", toWeekParam(date));
      return `?${params.toString()}`;
    },
    [searchParams]
  );

  const prevWeek = useMemo(
    () => addDays(weekStart, -7),
    [weekStart]
  );
  const nextWeek = useMemo(
    () => addDays(weekStart, 7),
    [weekStart]
  );

  useEffect(() => {
    setCalendarDate(format(weekStart, "yyyy-MM-dd"));
  }, [weekStart]);

  useEffect(() => {
    let isActive = true;
    (async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setShifts([]);
        setEmployees([]);
        return;
      }
      try {
        setLoading(true);
        const [scheduleRes, employeesRes] = await Promise.all([
          getShiftsByWeek(weekStart, LOCATION_ID),
          getEmployees(),
        ]);
        if (!isActive) return;
        setShifts(scheduleRes.shifts);
        setEmployees(employeesRes);
      } catch (err) {
        console.error(err);
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load schedule.");
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [weekStart]);

  const shiftsByDay = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      map[format(d, "yyyy-MM-dd")] = [];
    }
    shifts.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [shifts, weekStart]);

  function handleCalendarDateChange(value: string) {
    setCalendarDate(value);
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const nextWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    router.push(setWeekParam(nextWeekStart));
  }

  const weekSummary = useMemo(() => {
    const byEmployee = new Map<
      string,
      { name: string; hours: number; contract: number; max: number; rate: number }
    >();
    employees.forEach((e) => {
      byEmployee.set(e.id, {
        name: e.name,
        hours: 0,
        contract: e.contractHours,
        max: e.maxWeeklyHours,
        rate: e.hourlyRate ?? 0,
      });
    });
    shifts.forEach((s) => {
      const h = shiftHours(s.startTime, s.endTime);
      const cur = byEmployee.get(s.employeeId);
      if (cur) cur.hours += h;
    });
    let totalHours = 0;
    let totalCost = 0;
    byEmployee.forEach((v) => {
      totalHours += v.hours;
      totalCost += v.hours * v.rate;
    });
    return {
      byEmployee: Array.from(byEmployee.entries()).map(([id, v]) => ({
        id,
        ...v,
      })),
      totalHours,
      totalCost,
    };
  }, [shifts, employees]);

  const roleOptions = useMemo(
    () => [
      { value: "service", label: t("role.service") },
      { value: "shiftleader", label: t("role.shiftleader") },
      { value: "rutin", label: t("role.rutin") },
    ],
    [t]
  );

  const startParts = useMemo(() => to12hParts(form.startTime), [form.startTime]);
  const endParts = useMemo(() => to12hParts(form.endTime), [form.endTime]);

  const updateTimeField = useCallback(
    (
      field: "startTime" | "endTime",
      patch: Partial<{ hour: string; minute: string; period: Period }>
    ) => {
      setForm((prev) => {
        const current = to12hParts(prev[field]);
        const next = {
          hour: patch.hour ?? current.hour,
          minute: patch.minute ?? current.minute,
          period: patch.period ?? current.period,
        };
        return {
          ...prev,
          [field]: from12hParts(next.hour, next.minute, next.period),
        };
      });
    },
    []
  );

  function openAdd(day: string) {
    setAddModalDay(day);
    setForm({
      ...emptyShiftForm,
      date: day,
      startTime: "10:00",
      endTime: "18:00",
    });
    if (employees.length) setForm((f) => ({ ...f, employeeId: employees[0].id, role: employees[0].role }));
    setAddModalOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditingShift(shift);
    setForm({
      employeeId: shift.employeeId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      role: shift.role,
      notes: shift.notes ?? "",
      publishNow: shift.status === "published",
    });
    setEditModalOpen(true);
  }

  function closeAdd() {
    setAddModalOpen(false);
    setAddModalDay("");
    setForm(emptyShiftForm);
  }

  function closeEdit() {
    setEditModalOpen(false);
    setEditingShift(null);
  }

  function onSelectEmployee(employeeId: string) {
    const emp = employees.find((e) => e.id === employeeId);
    setForm((f) => ({
      ...f,
      employeeId,
      role: emp?.role ?? f.role,
    }));
  }

  async function handleCreate(publishNowOverride?: boolean) {
    if (!isSupabaseConfigured || !form.employeeId || !form.date) return;
    const asPublished = publishNowOverride ?? form.publishNow;
    setSaving(true);
    setError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticShift: Shift = {
      id: optimisticId,
      employeeId: form.employeeId,
      employeeName:
        employees.find((emp) => emp.id === form.employeeId)?.name ?? "",
      role: form.role,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      locationId: LOCATION_ID,
      status: asPublished ? "published" : "draft",
      createdByAi: false,
      notes: form.notes || undefined,
    };
    setShifts((prev) =>
      [...prev, optimisticShift].sort((a, b) => a.date.localeCompare(b.date))
    );
    try {
      const payload: CreateShiftInput = {
        employeeId: form.employeeId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        role: form.role,
        locationId: LOCATION_ID,
        status: asPublished ? "published" : "draft",
        notes: form.notes || undefined,
      };
      const created = await createShift(payload);
      setShifts((prev) =>
        prev
          .map((shift) => (shift.id === optimisticId ? created : shift))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
      toast.success("Shift added");
      closeAdd();
    } catch (err) {
      console.error(err);
      setShifts((prev) => prev.filter((shift) => shift.id !== optimisticId));
      setError("Failed to add shift.");
      toast.error("Failed to save — try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingShift || !isSupabaseConfigured) return;
    setSaving(true);
    setError(null);
    const previousShift = editingShift;
    const optimisticShift: Shift = {
      ...editingShift,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      role: form.role,
      notes: form.notes || undefined,
      status: form.publishNow ? "published" : "draft",
    };
    setShifts((prev) =>
      prev.map((shift) => (shift.id === editingShift.id ? optimisticShift : shift))
    );
    try {
      const updated = await updateShift(editingShift.id, {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        role: form.role,
        notes: form.notes || undefined,
        status: form.publishNow ? "published" : "draft",
      });
      setShifts((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      toast.success("Shift added");
      closeEdit();
    } catch (err) {
      console.error(err);
      setShifts((prev) =>
        prev.map((s) => (s.id === previousShift.id ? previousShift : s))
      );
      setError("Failed to update shift.");
      toast.error("Failed to save — try again");
    } finally {
      setSaving(false);
    }
  }

  function openDelete(shift: Shift) {
    setShiftToDelete(shift);
    setDeleteModalOpen(true);
  }

  function closeDelete() {
    setShiftToDelete(null);
    setDeleteModalOpen(false);
  }

  async function handleDelete() {
    if (!shiftToDelete || !isSupabaseConfigured) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteShift(shiftToDelete.id);
      setShifts((prev) => prev.filter((s) => s.id !== shiftToDelete.id));
      closeDelete();
    } catch (err) {
      console.error(err);
      setError("Failed to delete shift.");
      toast.error("Failed to save — try again");
    } finally {
      setDeleting(false);
    }
  }

  const hasShifts = shifts.length > 0;

  return (
    <div className="flex flex-col gap-4 2xl:flex-row">
      <div className="min-w-0 flex-1">
        {/* Week nav + Publish */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="border-[#2a2a2a] text-[#f0f0f0]" asChild>
              <Link href={setWeekParam(prevWeek)}>
                <ChevronLeft className="h-4 w-4" />
                {t("schedule.prevWeek")}
              </Link>
            </Button>
            <span className="font-mono text-sm text-[#f0f0f0]">
              {t("tabs.week")} {weekNumber}, {weekLabel}
            </span>
            <Button variant="outline" size="sm" className="border-[#2a2a2a] text-[#f0f0f0]" asChild>
              <Link href={setWeekParam(nextWeek)}>
                {t("schedule.nextWeek")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Input
              type="date"
              value={calendarDate}
              onChange={(e) => handleCalendarDateChange(e.target.value)}
              className="h-8 w-[160px] border-[#2a2a2a] bg-[#141414] text-xs text-[#f0f0f0]"
            />
          </div>
          <Button
            size="sm"
            className="bg-[#e8b84b] text-black hover:bg-[#f0c75c]"
            onClick={() => toast.success("Schedule published")}
          >
            {t("schedule.publishWeek")}
          </Button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="overflow-x-auto">
            <div className="min-w-[720px] space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded border border-[#2a2a2a] bg-[#141414]"
                />
              ))}
            </div>
          </div>
        ) : !hasShifts ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#2a2a2a] bg-[#111] py-16 text-center">
            <CalendarIcon className="mb-3 h-12 w-12 text-[#444]" />
            <p className="text-sm text-[#888]">
              No shifts this week — add manually or use the AI Agent
            </p>
            <Link
              href="/dashboard/ai-agent"
              className="mt-2 text-xs text-[#e8b84b] underline underline-offset-4"
            >
              Open AI Agent
            </Link>
            <div className="mt-4 flex gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const d = addDays(weekStart, i);
                return (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="border-[#2a2a2a]"
                    onClick={() => openAdd(format(d, "yyyy-MM-dd"))}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {t(DAY_KEYS[i])}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px] space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const d = addDays(weekStart, i);
                const dayStr = format(d, "yyyy-MM-dd");
                const dayShifts = shiftsByDay[dayStr] ?? [];
                return (
                  <div
                    key={dayStr}
                    className="flex min-h-[52px] items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-2"
                  >
                    <Link
                      href={`/dashboard/schedule/day?date=${dayStr}&week=${toWeekParam(weekStart)}`}
                      className="w-24 shrink-0 text-left font-mono text-xs text-[#888] transition-colors hover:text-[#e8b84b]"
                    >
                      {t(DAY_KEYS[i])}
                    </Link>
                    <div className="w-20 shrink-0 font-mono text-sm text-[#f0f0f0]">
                      {format(d, "d MMM")}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {dayShifts.map((shift) => {
                        const hours = shiftHours(shift.startTime, shift.endTime);
                        return (
                          <div
                            key={shift.id}
                            className={`${roleChipClass(shift.role)} group relative flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:opacity-90`}
                            onClick={() => openEdit(shift)}
                            title={`${shift.employeeName} • ${shift.role} • ${hours.toFixed(1)}h`}
                          >
                            {shift.createdByAi && (
                              <Sparkles className="h-3 w-3 shrink-0 text-current opacity-80" />
                            )}
                            <span className="truncate">
                              {shift.employeeName} • {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                            </span>
                            <button
                              type="button"
                              className="ml-0.5 rounded p-0.5 opacity-70 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDelete(shift);
                              }}
                              aria-label={t("schedule.deleteShift")}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 text-[#666] hover:bg-[#1c1c1c] hover:text-[#e8b84b]"
                        onClick={() => openAdd(dayStr)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Week summary sidebar */}
      <aside
        className="m-[10px] w-full shrink-0 border-t border-[#2a2a2a] bg-[#141414] p-4 2xl:!w-[320px] 2xl:!min-w-[320px] 2xl:!basis-[320px] 2xl:border-t-0 2xl:border-l"
      >
        <h3 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-[#888]">
          {t("schedule.weekSummary")}
        </h3>
        <div className="space-y-2 text-sm">
          {weekSummary.byEmployee
            .filter((e) => e.hours > 0)
            .map((e) => {
              const pct = e.max > 0 ? e.hours / e.max : 0;
              const color =
                pct > 1
                  ? "text-red-400"
                  : pct >= 0.9
                    ? "text-amber-400"
                    : "text-emerald-400";
              return (
                <div
                  key={e.id}
                  className="flex justify-between gap-2 font-mono"
                >
                  <span className="truncate text-[#f0f0f0]">{e.name}</span>
                  <span className={color}>{e.hours.toFixed(1)}h</span>
                </div>
              );
            })}
        </div>
        <div className="mt-4 border-t border-[#2a2a2a] pt-3 text-xs">
          <div className="flex justify-between font-mono text-[#888]">
            <span>{t("schedule.totalHours")}</span>
            <span className="text-[#f0f0f0]">{weekSummary.totalHours.toFixed(1)}h</span>
          </div>
          <div className="mt-1 flex justify-between font-mono text-[#888]">
            <span>{t("schedule.estimatedCost")}</span>
            <span className="text-[#f0f0f0]">
              {weekSummary.totalCost.toFixed(0)} SEK
            </span>
          </div>
        </div>
      </aside>

      {/* Add Shift modal */}
      <Dialog open={addModalOpen} onOpenChange={(open) => !open && closeAdd()}>
        <DialogContent className="max-w-md border-[#2a2a2a] bg-[#141414]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {t("schedule.addShift")}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888]">
              {t("schedule.addShift")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.name")}
              </label>
              <Select
                value={form.employeeId}
                onValueChange={onSelectEmployee}
              >
                <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                  <SelectValue placeholder={t("label.name")} />
                </SelectTrigger>
                <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({t(`role.${emp.role}` as any)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.date")}
              </label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="border-[#2a2a2a] bg-[#0f0f0f]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#888]">
                  {t("label.startTime")}
                </label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Select
                    value={startParts.hour}
                    onValueChange={(v) => updateTimeField("startTime", { hour: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {HOUR_OPTIONS.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={startParts.minute}
                    onValueChange={(v) => updateTimeField("startTime", { minute: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {MINUTE_OPTIONS.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={startParts.period}
                    onValueChange={(v) =>
                      updateTimeField("startTime", { period: v as Period })
                    }
                  >
                    <SelectTrigger className="w-[76px] border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {PERIOD_OPTIONS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#888]">
                  {t("label.endTime")}
                </label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Select
                    value={endParts.hour}
                    onValueChange={(v) => updateTimeField("endTime", { hour: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {HOUR_OPTIONS.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={endParts.minute}
                    onValueChange={(v) => updateTimeField("endTime", { minute: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {MINUTE_OPTIONS.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={endParts.period}
                    onValueChange={(v) => updateTimeField("endTime", { period: v as Period })}
                  >
                    <SelectTrigger className="w-[76px] border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {PERIOD_OPTIONS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.role")}
              </label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.notes")}
              </label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("label.notes")}
                className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={closeAdd}
              disabled={saving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-[#2a2a2a]"
              onClick={() => handleCreate()}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("schedule.saveAsDraft")}
            </Button>
            <Button
              size="sm"
              className="bg-[#e8b84b] text-black"
              onClick={() => handleCreate(true)}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("schedule.publishImmediately")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shift modal */}
      <Dialog open={editModalOpen} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-md border-[#2a2a2a] bg-[#141414]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {t("schedule.editShift")}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888]">
              {t("schedule.editShift")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.date")}
              </label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="border-[#2a2a2a] bg-[#0f0f0f]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#888]">
                  {t("label.startTime")}
                </label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Select
                    value={startParts.hour}
                    onValueChange={(v) => updateTimeField("startTime", { hour: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {HOUR_OPTIONS.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={startParts.minute}
                    onValueChange={(v) => updateTimeField("startTime", { minute: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {MINUTE_OPTIONS.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={startParts.period}
                    onValueChange={(v) =>
                      updateTimeField("startTime", { period: v as Period })
                    }
                  >
                    <SelectTrigger className="w-[76px] border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {PERIOD_OPTIONS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#888]">
                  {t("label.endTime")}
                </label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Select
                    value={endParts.hour}
                    onValueChange={(v) => updateTimeField("endTime", { hour: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {HOUR_OPTIONS.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={endParts.minute}
                    onValueChange={(v) => updateTimeField("endTime", { minute: v })}
                  >
                    <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {MINUTE_OPTIONS.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={endParts.period}
                    onValueChange={(v) => updateTimeField("endTime", { period: v as Period })}
                  >
                    <SelectTrigger className="w-[76px] border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                      {PERIOD_OPTIONS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.role")}
              </label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">
                {t("label.notes")}
              </label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={closeEdit}
              disabled={saving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-[#e8b84b] text-black"
              onClick={handleUpdate}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("button.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteModalOpen} onOpenChange={(open) => !open && closeDelete()}>
        <DialogContent className="border-[#2a2a2a] bg-[#141414]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {t("schedule.deleteShift")}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#bbbbbb]">
              {t("schedule.deleteShiftConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={closeDelete}
              disabled={deleting}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("schedule.deleteShift")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

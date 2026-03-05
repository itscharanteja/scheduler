"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, getISOWeek, getISOWeekYear, isSameMonth, setISOWeek, setISOWeekYear, startOfMonth, startOfWeek, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Plus, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { createShift, deleteShift, getEmployees, getShiftsByMonth, getShiftsByWeek, isSupabaseConfigured, updateShift, type CreateShiftInput } from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 26;

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

function parseMonthParam(monthParam: string | null): Date {
  if (!monthParam) return new Date();
  const parsed = new Date(`${monthParam}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function toMonthParam(date: Date): string {
  return format(date, "yyyy-MM");
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
      return "text-sky-700 border-sky-200/80 bg-sky-100/60";
    case "shiftleader":
      return "text-amber-700 border-amber-200/80 bg-amber-100/60";
    case "rutin":
      return "text-violet-700 border-violet-200/80 bg-violet-100/60";
    default:
      return "text-slate-700 border-slate-200/80 bg-white/70";
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

type ShiftActionModalProps = {
  t: ReturnType<typeof useLanguage>["t"];
  shift: Shift | null;
  open: boolean;
  saving: boolean;
  deleting: boolean;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

function ShiftActionModal({
  t,
  shift,
  open,
  saving,
  deleting,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onClose,
  onSave,
  onDelete,
}: ShiftActionModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="glass-shift-modal max-w-md border-none bg-transparent">
        <DialogHeader>
          <DialogTitle className="font-mono text-slate-900">
            {shift?.employeeName || t("label.name")}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-700">
            {shift
              ? `${format(new Date(shift.date), "PPP")} • ${shift.startTime.slice(0, 5)} – ${shift.endTime.slice(0, 5)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 space-y-3 text-sm text-slate-800">
          <div>
            <span className="font-medium">Role: </span>
            <span>{shift?.role}</span>
          </div>
          <div>
            <span className="font-medium">Date: </span>
            <span>
              {shift ? format(new Date(shift.date), "EEEE, MMM d, yyyy") : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                {t("label.startTime")}
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="h-10 border-white/80 bg-white/70"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                {t("label.endTime")}
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="h-10 border-white/80 bg-white/70"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-5 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            type="button"
            className="glass-popup-button text-slate-900"
            onClick={onClose}
            disabled={saving || deleting}
          >
            {t("button.cancel")}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              className="glass-popup-button border-white/90 bg-white/80 text-slate-900"
              onClick={onSave}
              disabled={saving || deleting || !startTime || !endTime}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("button.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="glass-popup-button text-red-600"
              onClick={onDelete}
              disabled={saving || deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("schedule.deleteShift")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DayScheduleView() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = useMemo(() => parseWeekParam(searchParams.get("week")), [searchParams]);

  const dateParam = searchParams.get("date");
  const selectedDay = dateParam ?? format(weekStart, "yyyy-MM-dd");
  const selectedDate = useMemo(() => new Date(`${selectedDay}T00:00:00`), [selectedDay]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dayShifts, setDayShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [modalStartTime, setModalStartTime] = useState("");
  const [modalEndTime, setModalEndTime] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalDeleting, setModalDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [form, setForm] = useState<ShiftFormState>({
    ...emptyShiftForm,
    date: selectedDay,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setEmployees([]);
        setDayShifts([]);
        return;
      }
      try {
        setLoading(true);
        const [employeeRows, weekSchedule] = await Promise.all([
          getEmployees(),
          getShiftsByWeek(weekStart, LOCATION_ID),
        ]);
        if (!active) return;
        setEmployees(employeeRows);
        setDayShifts(weekSchedule.shifts.filter((shift) => shift.date === selectedDay));
      } catch (err) {
        console.error(err);
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load day schedule.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedDay, weekStart]);

  const prevDay = subDays(selectedDate, 1);
  const nextDay = addDays(selectedDate, 1);

  const hourLabels = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    []
  );

  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    dayShifts.forEach((shift) => {
      const existing = map.get(shift.employeeId) ?? [];
      existing.push(shift);
      map.set(shift.employeeId, existing);
    });
    return map;
  }, [dayShifts]);

  const daySummary = useMemo(() => {
    const totalHours = dayShifts.reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
    const totalShifts = dayShifts.length;
    const activeEmployees = new Set(dayShifts.map((shift) => shift.employeeId)).size;
    const overlappingShifts = countOverlappingShifts(dayShifts);
    return {
      totalHours,
      totalShifts,
      activeEmployees,
      overlappingShifts,
    };
  }, [dayShifts]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      date: selectedDay,
      employeeId: prev.employeeId || employees[0]?.id || "",
      role: employees.find((employee) => employee.id === (prev.employeeId || employees[0]?.id))?.role ?? prev.role,
    }));
  }, [employees, selectedDay]);

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

  function openAddModal() {
    setForm({
      ...emptyShiftForm,
      date: selectedDay,
      employeeId: employees[0]?.id ?? "",
      role: employees[0]?.role ?? "service",
      notes: "",
    });
    setAddModalOpen(true);
  }

  function closeAddModal() {
    setAddModalOpen(false);
    setForm((prev) => ({ ...prev, date: selectedDay }));
  }

  async function handleCreateDayShift() {
    if (!isSupabaseConfigured || !form.employeeId || !selectedDay) return;
    setAddSaving(true);
    setError(null);
    const optimisticId = `optimistic-day-${Date.now()}`;
    const employeeName = employees.find((employee) => employee.id === form.employeeId)?.name ?? "";
    const optimisticShift: Shift = {
      id: optimisticId,
      employeeId: form.employeeId,
      employeeName,
      role: form.role,
      date: selectedDay,
      startTime: form.startTime,
      endTime: form.endTime,
      locationId: LOCATION_ID,
      status: "draft",
      createdByAi: false,
      notes: form.notes || undefined,
    };

    setDayShifts((prev) => [...prev, optimisticShift].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    try {
      const created = await createShift({
        employeeId: form.employeeId,
        date: selectedDay,
        startTime: form.startTime,
        endTime: form.endTime,
        role: form.role,
        locationId: LOCATION_ID,
        status: "draft",
        notes: form.notes || undefined,
      });
      setDayShifts((prev) =>
        prev
          .map((shift) => (shift.id === optimisticId ? { ...created, employeeName: created.employeeName || employeeName } : shift))
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
      toast.success("Shift added");
      closeAddModal();
    } catch (err) {
      console.error(err);
      setDayShifts((prev) => prev.filter((shift) => shift.id !== optimisticId));
      setError("Failed to add shift.");
      toast.error("Failed to save — try again");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDayShiftUpdate() {
    if (!selectedShift || !isSupabaseConfigured || !modalStartTime || !modalEndTime) return;
    setModalSaving(true);
    setError(null);
    try {
      const updated = await updateShift(selectedShift.id, {
        startTime: modalStartTime,
        endTime: modalEndTime,
      });
      setDayShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Shift updated");
      closeShiftModal();
    } catch (err) {
      console.error(err);
      setError("Failed to update shift.");
      toast.error("Failed to save — try again");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDayShiftDelete() {
    if (!selectedShift || !isSupabaseConfigured) return;
    setModalDeleting(true);
    setError(null);
    try {
      await deleteShift(selectedShift.id);
      setDayShifts((prev) => prev.filter((s) => s.id !== selectedShift.id));
      toast.success("Shift deleted");
      closeShiftModal();
    } catch (err) {
      console.error(err);
      setError("Failed to delete shift.");
      toast.error("Failed to save — try again");
    } finally {
      setModalDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="glass-button border-none bg-white/75 text-slate-900" asChild>
            <Link href={`/dashboard/schedule?tab=day&date=${format(prevDay, "yyyy-MM-dd")}&week=${toWeekParam(startOfWeek(prevDay, { weekStartsOn: 1 }))}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="font-mono text-sm text-slate-800">
            {format(selectedDate, "EEEE, d MMM yyyy")}
          </div>
          <Button variant="outline" size="sm" className="glass-button border-none bg-white/75 text-slate-900" asChild>
            <Link href={`/dashboard/schedule?tab=day&date=${format(nextDay, "yyyy-MM-dd")}&week=${toWeekParam(startOfWeek(nextDay, { weekStartsOn: 1 }))}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDay}
            onChange={(e) => {
              const value = e.target.value;
              const next = new Date(`${value}T00:00:00`);
              if (Number.isNaN(next.getTime())) return;
              router.push(`/dashboard/schedule?tab=day&date=${value}&week=${toWeekParam(startOfWeek(next, { weekStartsOn: 1 }))}`);
            }}
            className="h-9 w-[164px] border-white/70 bg-white/70 text-xs"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="mb-3 flex items-center justify-end">
          <Button
            size="sm"
            className="glass-button border-none bg-white/82 text-slate-900"
            onClick={openAddModal}
            disabled={!employees.length}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("schedule.addShift")}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/75 bg-white/60">
          <div className="min-w-[1180px]">
            <div className="sticky top-0 z-20 mb-1 grid grid-cols-[220px_1fr] bg-white/70 backdrop-blur-md">
              <div />
              <div className="relative h-8 border-l border-b border-black/5 bg-white/65">
                {hourLabels.map((hour) => {
                  const leftPct = ((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100;
                  const labelHour = hour >= 24 ? hour - 24 : hour;
                  return (
                    <div
                      key={`tick-${hour}`}
                      className="absolute top-0 h-full border-l border-black/8"
                      style={{ left: `${leftPct}%` }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-500">
                        {`${labelHour.toString().padStart(2, "0")}:00`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={`skeleton-${idx}`} className="grid grid-cols-[220px_1fr]">
                    <div className="h-20 rounded-l-xl border border-black/5 bg-white/70" />
                    <div className="h-20 rounded-r-xl border border-l-0 border-black/5 bg-white/55" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {employees.map((employee) => {
                  const employeeShifts = shiftsByEmployee.get(employee.id) ?? [];
                  return (
                    <div key={employee.id} className="grid grid-cols-[220px_1fr]">
                      <div className="flex items-center rounded-l-xl border border-black/5 bg-white/78 px-4 py-4">
                        <span className="truncate text-sm font-medium text-slate-800">{employee.name}</span>
                      </div>
                      <div className="relative h-[84px] rounded-r-xl border border-l-0 border-black/5 bg-white/58">
                        {hourLabels.map((hour) => {
                          const leftPct = ((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100;
                          return (
                            <div
                              key={`grid-${employee.id}-${hour}`}
                              className="absolute top-0 h-full border-l border-black/7"
                              style={{ left: `${leftPct}%` }}
                            />
                          );
                        })}

                        {employeeShifts.map((shift) => {
                          const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
                          const startMinutes = Math.max(timeToMinutes(shift.startTime), DAY_START_HOUR * 60);
                          const rawEnd = timeToMinutes(shift.endTime);
                          const normalizedEnd = rawEnd < DAY_START_HOUR * 60 ? rawEnd + 24 * 60 : rawEnd;
                          const endMinutes = Math.min(normalizedEnd, DAY_END_HOUR * 60);
                          const leftPct = ((startMinutes - DAY_START_HOUR * 60) / totalMinutes) * 100;
                          const widthPct = ((endMinutes - startMinutes) / totalMinutes) * 100;

                          return (
                            <div
                              key={shift.id}
                              className={`glass-shift ${roleChipClass(shift.role)} absolute top-2 h-[68px] cursor-pointer rounded-xl px-3 py-2`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${Math.max(widthPct, 8)}%`,
                              }}
                              onClick={() => openShiftModal(shift)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openShiftModal(shift);
                                }
                              }}
                            >
                              <div className="text-[11px] text-slate-700">
                                {shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}
                              </div>
                              <div className="truncate text-xs font-semibold">{shift.role}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-slate-500">
          Day Summary
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Total Hours</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{daySummary.totalHours.toFixed(1)}h</div>
          </div>
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Total Shifts</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{daySummary.totalShifts}</div>
          </div>
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Active Employees</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{daySummary.activeEmployees}</div>
          </div>
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Overlapping Shifts</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{daySummary.overlappingShifts}</div>
          </div>
        </div>
      </div>

      <Dialog open={addModalOpen} onOpenChange={(open) => !open && closeAddModal()}>
        <DialogContent className="glass-card max-w-md border-none bg-white/82">
          <DialogHeader>
            <DialogTitle className="font-mono text-slate-900">{t("schedule.addShift")}</DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              {format(selectedDate, "EEEE, MMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs text-slate-600">{t("label.name")}</label>
              <Select
                value={form.employeeId}
                onValueChange={(employeeId) => {
                  const employee = employees.find((item) => item.id === employeeId);
                  setForm((prev) => ({
                    ...prev,
                    employeeId,
                    role: employee?.role ?? prev.role,
                  }));
                }}
              >
                <SelectTrigger className="w-full border-white/80 bg-white/70 text-sm">
                  <SelectValue placeholder={t("label.name")} />
                </SelectTrigger>
                <SelectContent className="border-white/80 bg-white/85">
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">{t("label.date")}</label>
              <Input value={selectedDay} readOnly disabled className="border-white/80 bg-white/70 text-slate-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">{t("label.startTime")}</label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="border-white/80 bg-white/70 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">{t("label.endTime")}</label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="border-white/80 bg-white/70 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">{t("label.notes")}</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t("label.notes")}
                className="border-white/80 bg-white/70 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="glass-button border-none bg-white/70 text-slate-900"
              onClick={closeAddModal}
              disabled={addSaving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="glass-button border-none bg-white/82 text-slate-900"
              onClick={handleCreateDayShift}
              disabled={addSaving || !form.employeeId || !form.startTime || !form.endTime}
            >
              {addSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("button.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftActionModal
        t={t}
        shift={selectedShift}
        open={shiftModalOpen}
        saving={modalSaving}
        deleting={modalDeleting}
        startTime={modalStartTime}
        endTime={modalEndTime}
        onStartTimeChange={setModalStartTime}
        onEndTimeChange={setModalEndTime}
        onClose={closeShiftModal}
        onSave={handleDayShiftUpdate}
        onDelete={handleDayShiftDelete}
      />
    </div>
  );
}

function WeekScheduleView() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");
  const weekStart = useMemo(() => parseWeekParam(weekParam), [weekParam]);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<ShiftFormState>(emptyShiftForm);
  const [saving, setSaving] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [modalStartTime, setModalStartTime] = useState("");
  const [modalEndTime, setModalEndTime] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalDeleting, setModalDeleting] = useState(false);
  const [calendarDate, setCalendarDate] = useState("");

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekLabel = `${format(weekStart, "d MMM")}–${format(weekEnd, "d MMM")}`;
  const weekNumber = getISOWeek(weekStart);

  const setWeekParam = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("week", toWeekParam(date));
      params.set("tab", "week");
      return `?${params.toString()}`;
    },
    [searchParams]
  );

  const prevWeek = useMemo(() => addDays(weekStart, -7), [weekStart]);
  const nextWeek = useMemo(() => addDays(weekStart, 7), [weekStart]);

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

  const weekDateOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        return {
          value: format(day, "yyyy-MM-dd"),
          label: `${t(DAY_KEYS[i])} • ${format(day, "d MMM")}`,
        };
      }),
    [t, weekStart]
  );

  function handleCalendarDateChange(value: string) {
    setCalendarDate(value);
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const nextWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    router.push(setWeekParam(nextWeekStart));
  }

  const weekSummary = useMemo(() => {
    const byEmployee = new Map<string, { name: string; hours: number; max: number; rate: number }>();
    employees.forEach((employee) => {
      byEmployee.set(employee.id, {
        name: employee.name,
        hours: 0,
        max: employee.maxWeeklyHours,
        rate: employee.hourlyRate ?? 0,
      });
    });

    shifts.forEach((shift) => {
      const current = byEmployee.get(shift.employeeId);
      if (current) {
        current.hours += shiftHours(shift.startTime, shift.endTime);
      }
    });

    let totalHours = 0;
    let totalCost = 0;
    byEmployee.forEach((entry) => {
      totalHours += entry.hours;
      totalCost += entry.hours * entry.rate;
    });

    const scheduledEmployeeCount = Array.from(byEmployee.values()).filter((entry) => entry.hours > 0).length;
    const totalShifts = shifts.length;
    const averageHoursPerEmployee = scheduledEmployeeCount > 0 ? totalHours / scheduledEmployeeCount : 0;

    return {
      byEmployee: Array.from(byEmployee.entries()).map(([id, value]) => ({ id, ...value })),
      totalHours,
      totalCost,
      totalShifts,
      scheduledEmployeeCount,
      averageHoursPerEmployee,
    };
  }, [employees, shifts]);

  const roleOptions = useMemo(
    () => [
      { value: "service", label: t("role.service") },
      { value: "shiftleader", label: t("role.shiftleader") },
      { value: "rutin", label: t("role.rutin") },
    ],
    [t]
  );

  function openAdd(day: string) {
    setForm({ ...emptyShiftForm, date: day, startTime: "10:00", endTime: "18:00" });
    if (employees.length) setForm((f) => ({ ...f, employeeId: employees[0].id, role: employees[0].role }));
    setAddModalOpen(true);
  }

  function openShiftModal(shift: Shift) {
    setSelectedShift(shift);
    setModalStartTime(shift.startTime.slice(0, 5));
    setModalEndTime(shift.endTime.slice(0, 5));
    setShiftModalOpen(true);
  }

  function closeAdd() {
    setAddModalOpen(false);
    setForm(emptyShiftForm);
  }

  function closeShiftModal() {
    setShiftModalOpen(false);
    setSelectedShift(null);
    setModalStartTime("");
    setModalEndTime("");
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
    const weekDates = new Set(weekDateOptions.map((option) => option.value));
    if (!weekDates.has(form.date)) {
      setError("Select a date in the current week.");
      return;
    }
    const asPublished = publishNowOverride ?? form.publishNow;
    setSaving(true);
    setError(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticShift: Shift = {
      id: optimisticId,
      employeeId: form.employeeId,
      employeeName: employees.find((emp) => emp.id === form.employeeId)?.name ?? "",
      role: form.role,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      locationId: LOCATION_ID,
      status: asPublished ? "published" : "draft",
      createdByAi: false,
      notes: form.notes || undefined,
    };

    setShifts((prev) => [...prev, optimisticShift].sort((a, b) => a.date.localeCompare(b.date)));

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

  async function handleWeekShiftUpdate() {
    if (!selectedShift || !isSupabaseConfigured || !modalStartTime || !modalEndTime) return;
    setModalSaving(true);
    setError(null);
    const previousShift = selectedShift;

    const optimisticShift: Shift = {
      ...selectedShift,
      startTime: modalStartTime,
      endTime: modalEndTime,
    };

    setShifts((prev) => prev.map((shift) => (shift.id === selectedShift.id ? optimisticShift : shift)));

    try {
      const updated = await updateShift(selectedShift.id, {
        startTime: modalStartTime,
        endTime: modalEndTime,
      });
      setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Shift updated");
      closeShiftModal();
    } catch (err) {
      console.error(err);
      setShifts((prev) => prev.map((s) => (s.id === previousShift.id ? previousShift : s)));
      setError("Failed to update shift.");
      toast.error("Failed to save — try again");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleWeekShiftDelete() {
    if (!selectedShift || !isSupabaseConfigured) return;
    setModalDeleting(true);
    setError(null);
    try {
      await deleteShift(selectedShift.id);
      setShifts((prev) => prev.filter((s) => s.id !== selectedShift.id));
      closeShiftModal();
      toast.success("Shift deleted");
    } catch (err) {
      console.error(err);
      setError("Failed to delete shift.");
      toast.error("Failed to save — try again");
    } finally {
      setModalDeleting(false);
    }
  }

  const hasShifts = shifts.length > 0;

  return (
    <div className="flex flex-col gap-4 2xl:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="glass-button border-none bg-white/75 text-slate-900" asChild>
              <Link href={setWeekParam(prevWeek)}>
                <ChevronLeft className="h-4 w-4" />
                {t("schedule.prevWeek")}
              </Link>
            </Button>
            <span className="font-mono text-sm text-slate-800">
              {t("tabs.week")} {weekNumber}, {weekLabel}
            </span>
            <Button variant="outline" size="sm" className="glass-button border-none bg-white/75 text-slate-900" asChild>
              <Link href={setWeekParam(nextWeek)}>
                {t("schedule.nextWeek")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Input
              type="date"
              value={calendarDate}
              onChange={(e) => handleCalendarDateChange(e.target.value)}
              className="h-9 w-[160px] border-white/70 bg-white/70 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="glass-button border-none bg-white/82 text-slate-900"
            onClick={() => toast.success("Schedule published")}
          >
            {t("schedule.publishWeek")}
          </Button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="glass-card p-4">
          <div className="mb-3 flex justify-end">
            <Button
              size="sm"
              className="glass-button border-none bg-white/82 text-slate-900"
              onClick={() => openAdd(format(weekStart, "yyyy-MM-dd"))}
              disabled={!employees.length}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("schedule.addShift")}
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl border border-white/70 bg-white/55" />
              ))}
            </div>
          ) : !hasShifts ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/70 bg-white/60 py-16 text-center">
              <CalendarIcon className="mb-3 h-12 w-12 text-slate-400" />
              <p className="text-sm text-slate-600">No shifts this week — add manually or use the AI Agent</p>
              <Link href="/dashboard/ai-agent" className="mt-2 text-xs text-slate-700 underline underline-offset-4">
                Open AI Agent
              </Link>
              <div className="mt-4 flex flex-wrap gap-2 px-4">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const d = addDays(weekStart, i);
                  return (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="glass-button border-none bg-white/70 text-slate-900"
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
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const d = addDays(weekStart, i);
                const dayStr = format(d, "yyyy-MM-dd");
                const dayShifts = shiftsByDay[dayStr] ?? [];
                return (
                  <div
                    key={dayStr}
                    className="glass-muted flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/70 px-3 py-2"
                  >
                    <Link
                      href={`/dashboard/schedule/day?date=${dayStr}&week=${toWeekParam(weekStart)}`}
                      className="w-24 shrink-0 text-left font-mono text-xs text-slate-500 transition-colors hover:text-slate-800"
                    >
                      {t(DAY_KEYS[i])}
                    </Link>
                    <div className="w-20 shrink-0 font-mono text-sm text-slate-800">{format(d, "d MMM")}</div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {dayShifts.map((shift) => {
                        const hours = shiftHours(shift.startTime, shift.endTime);
                        return (
                          <div
                            key={shift.id}
                            className={`${roleChipClass(shift.role)} glass-shift group relative flex cursor-pointer items-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-medium`}
                            onClick={() => openShiftModal(shift)}
                            title={`${shift.employeeName} • ${shift.role} • ${hours.toFixed(1)}h`}
                          >
                            {shift.createdByAi && <Sparkles className="h-3 w-3 shrink-0 text-current opacity-80" />}
                            <span className="truncate">{shift.employeeName} • {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</span>
                          </div>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 text-slate-500 hover:bg-white/70 hover:text-slate-800"
                        onClick={() => openAdd(dayStr)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="glass-card m-[10px] w-full shrink-0 p-4 2xl:!w-[320px] 2xl:!min-w-[320px] 2xl:!basis-[320px]">
        <h3 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-slate-500">{t("schedule.weekSummary")}</h3>
        <div className="mb-3 space-y-1 rounded-xl border border-white/70 bg-white/55 p-3 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Total Shifts</span>
            <span className="font-mono text-slate-900">{weekSummary.totalShifts}</span>
          </div>
          <div className="flex justify-between">
            <span>Employees Scheduled</span>
            <span className="font-mono text-slate-900">{weekSummary.scheduledEmployeeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg Hours / Employee</span>
            <span className="font-mono text-slate-900">{weekSummary.averageHoursPerEmployee.toFixed(1)}h</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {weekSummary.byEmployee
            .filter((e) => e.hours > 0)
            .map((e) => {
              const pct = e.max > 0 ? e.hours / e.max : 0;
              const color = pct > 1 ? "text-red-500" : pct >= 0.9 ? "text-amber-500" : "text-emerald-600";
              return (
                <div key={e.id} className="flex justify-between gap-2 font-mono">
                  <span className="truncate text-slate-800">{e.name}</span>
                  <span className={color}>{e.hours.toFixed(1)}h</span>
                </div>
              );
            })}
        </div>
        <div className="mt-4 border-t border-black/7 pt-3 text-xs">
          <div className="flex justify-between font-mono text-slate-500">
            <span>{t("schedule.totalHours")}</span>
            <span className="text-slate-800">{weekSummary.totalHours.toFixed(1)}h</span>
          </div>
          <div className="mt-1 flex justify-between font-mono text-slate-500">
            <span>{t("schedule.estimatedCost")}</span>
            <span className="text-slate-800">{weekSummary.totalCost.toFixed(0)} SEK</span>
          </div>
        </div>
      </aside>

      <Dialog open={addModalOpen} onOpenChange={(open) => !open && closeAdd()}>
        <DialogContent className="glass-card max-w-md border-none bg-white/82">
          <DialogHeader>
            <DialogTitle className="font-mono text-slate-900">{t("schedule.addShift")}</DialogTitle>
            <DialogDescription className="text-xs text-slate-600">{t("schedule.addShift")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs text-slate-600">{t("label.name")}</label>
              <Select value={form.employeeId} onValueChange={onSelectEmployee}>
                <SelectTrigger className="w-full border-white/80 bg-white/70 text-sm">
                  <SelectValue placeholder={t("label.name")} />
                </SelectTrigger>
                <SelectContent className="border-white/80 bg-white/85">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({roleOptions.find((option) => option.value === emp.role)?.label ?? emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">{t("label.date")}</label>
              <Select value={form.date} onValueChange={(value) => setForm((f) => ({ ...f, date: value }))}>
                <SelectTrigger className="w-full border-white/80 bg-white/70 text-sm">
                  <SelectValue placeholder={t("label.date")} />
                </SelectTrigger>
                <SelectContent className="border-white/80 bg-white/85">
                  {weekDateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <label className="mb-1 block text-xs text-slate-600">{t("label.role")}</label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="w-full border-white/80 bg-white/70 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/80 bg-white/85">
                  {roleOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">{t("label.notes")}</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("label.notes")} className="border-white/80 bg-white/70 text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="glass-button border-none bg-white/70 text-slate-900" onClick={closeAdd} disabled={saving}>{t("button.cancel")}</Button>
            <Button size="sm" variant="outline" className="glass-button border-none bg-white/70 text-slate-900" onClick={() => handleCreate()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("schedule.saveAsDraft")}
            </Button>
            <Button size="sm" className="glass-button border-none bg-white/82 text-slate-900" onClick={() => handleCreate(true)} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("schedule.publishImmediately")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftActionModal
        t={t}
        shift={selectedShift}
        open={shiftModalOpen}
        saving={modalSaving}
        deleting={modalDeleting}
        startTime={modalStartTime}
        endTime={modalEndTime}
        onStartTimeChange={setModalStartTime}
        onEndTimeChange={setModalEndTime}
        onClose={closeShiftModal}
        onSave={handleWeekShiftUpdate}
        onDelete={handleWeekShiftDelete}
      />
    </div>
  );
}

function MonthScheduleView() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthDate = useMemo(() => parseMonthParam(searchParams.get("month")), [searchParams]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [modalStartTime, setModalStartTime] = useState("");
  const [modalEndTime, setModalEndTime] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalDeleting, setModalDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [form, setForm] = useState<ShiftFormState>(emptyShiftForm);

  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) }),
    [monthDate]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setEmployees([]);
        setShifts([]);
        return;
      }
      try {
        setLoading(true);
        const [empRes, shiftRes] = await Promise.all([
          getEmployees(),
          getShiftsByMonth(monthDate, LOCATION_ID),
        ]);
        if (!active) return;
        setEmployees(empRes);
        setShifts(shiftRes);
      } catch (err) {
        console.error(err);
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load month schedule.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [monthDate]);

  const shiftsByEmployeeAndDate = useMemo(() => {
    const map = new Map<string, Map<string, Shift[]>>();
    shifts.forEach((shift) => {
      const byEmp = map.get(shift.employeeId) ?? new Map<string, Shift[]>();
      const dateKey = shift.date;
      const list = byEmp.get(dateKey) ?? [];
      list.push(shift);
      byEmp.set(dateKey, list);
      map.set(shift.employeeId, byEmp);
    });
    return map;
  }, [shifts]);

  const prevMonth = useMemo(() => addMonths(monthDate, -1), [monthDate]);
  const nextMonth = useMemo(() => addMonths(monthDate, 1), [monthDate]);

  function goToMonth(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", toMonthParam(date));
    params.set("tab", "month");
    router.push(`?${params.toString()}`);
  }

  const monthLabel = format(monthDate, "MMMM yyyy");
  const totalColumns = daysInMonth.length;
  const gridTemplateColumns = `220px repeat(${totalColumns}, minmax(56px, 1fr))`;
  const monthDateOptions = useMemo(
    () =>
      daysInMonth.map((day) => ({
        value: format(day, "yyyy-MM-dd"),
        label: `${format(day, "EEE")} • ${format(day, "d MMM")}`,
      })),
    [daysInMonth]
  );

  const monthSummary = useMemo(() => {
    const totalShifts = shifts.length;
    const totalHours = shifts.reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
    const activeEmployees = new Set(shifts.map((shift) => shift.employeeId)).size;
    const averageShiftsPerEmployee = activeEmployees > 0 ? totalShifts / activeEmployees : 0;
    return {
      totalShifts,
      totalHours,
      activeEmployees,
      averageShiftsPerEmployee,
    };
  }, [shifts]);

  function openShiftModal(shift: Shift) {
    setSelectedShift(shift);
    setModalStartTime(shift.startTime.slice(0, 5));
    setModalEndTime(shift.endTime.slice(0, 5));
    setShiftModalOpen(true);
  }

  function closeShiftModal() {
    setShiftModalOpen(false);
    setSelectedShift(null);
    setModalStartTime("");
    setModalEndTime("");
  }

  function openAddModal() {
    const defaultDate = monthDateOptions[0]?.value ?? format(monthDate, "yyyy-MM-01");
    setForm({
      ...emptyShiftForm,
      date: defaultDate,
      employeeId: employees[0]?.id ?? "",
      role: employees[0]?.role ?? "service",
      notes: "",
    });
    setAddModalOpen(true);
  }

  function closeAddModal() {
    setAddModalOpen(false);
  }

  async function handleCreateMonthShift() {
    if (!isSupabaseConfigured || !form.employeeId || !form.date) return;
    const monthAllowed = new Set(monthDateOptions.map((option) => option.value));
    if (!monthAllowed.has(form.date)) {
      setError("Select a date in the current month.");
      return;
    }

    setAddSaving(true);
    setError(null);
    const optimisticId = `optimistic-month-${Date.now()}`;
    const employeeName = employees.find((employee) => employee.id === form.employeeId)?.name ?? "";
    const optimisticShift: Shift = {
      id: optimisticId,
      employeeId: form.employeeId,
      employeeName,
      role: form.role,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      locationId: LOCATION_ID,
      status: "draft",
      createdByAi: false,
      notes: form.notes || undefined,
    };
    setShifts((prev) => [...prev, optimisticShift].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)));
    try {
      const created = await createShift({
        employeeId: form.employeeId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        role: form.role,
        locationId: LOCATION_ID,
        status: "draft",
        notes: form.notes || undefined,
      });
      setShifts((prev) =>
        prev
          .map((shift) => (shift.id === optimisticId ? { ...created, employeeName: created.employeeName || employeeName } : shift))
          .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
      );
      toast.success("Shift added");
      closeAddModal();
    } catch (err) {
      console.error(err);
      setShifts((prev) => prev.filter((shift) => shift.id !== optimisticId));
      setError("Failed to add shift.");
      toast.error("Failed to save — try again");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleMonthShiftUpdate() {
    if (!selectedShift || !isSupabaseConfigured || !modalStartTime || !modalEndTime) return;
    setModalSaving(true);
    setError(null);
    try {
      const updated = await updateShift(selectedShift.id, {
        startTime: modalStartTime,
        endTime: modalEndTime,
      });
      setShifts((prev) => prev.map((shift) => (shift.id === updated.id ? updated : shift)));
      setSelectedShift(updated);
      toast.success("Shift updated");
      closeShiftModal();
    } catch (err) {
      console.error(err);
      setError("Failed to update shift.");
      toast.error("Failed to save — try again");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleMonthShiftDelete() {
    if (!selectedShift || !isSupabaseConfigured) return;
    setModalDeleting(true);
    setError(null);
    try {
      await deleteShift(selectedShift.id);
      setShifts((prev) => prev.filter((shift) => shift.id !== selectedShift.id));
      toast.success("Shift deleted");
      closeShiftModal();
    } catch (err) {
      console.error(err);
      setError("Failed to delete shift.");
      toast.error("Failed to save — try again");
    } finally {
      setModalDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="glass-button border-none bg-white/70 text-slate-900" onClick={() => goToMonth(prevMonth)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm text-slate-800">{monthLabel}</span>
          <Button variant="outline" size="sm" className="glass-button border-none bg-white/70 text-slate-900" onClick={() => goToMonth(nextMonth)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="glass-month-card p-3">
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            className="glass-button border-none bg-white/82 text-slate-900"
            onClick={openAddModal}
            disabled={!employees.length}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("schedule.addShift")}
          </Button>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-md bg-white/50" />
        ) : employees.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-600">{t("schedule.emptyState")}</div>
        ) : (
          <div className="overflow-hidden rounded-[20px] border border-white/75 bg-white/55">
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div className="grid text-xs text-slate-600" style={{ gridTemplateColumns }}>
                  <div className="sticky left-0 z-20 border-r border-black/5 bg-white/90 px-3 py-2 text-left font-mono backdrop-blur-md">{t("label.name")}</div>
                  {daysInMonth.map((day) => (
                    <div key={day.toISOString()} className="bg-white/50 px-1 py-2 text-center font-mono">
                      <div>{format(day, "d")}</div>
                      <div className="text-[10px] text-slate-500">{format(day, "EEE")}</div>
                    </div>
                  ))}
                </div>

                {employees.map((emp) => (
                  <div key={emp.id} className="grid border-t border-black/5 first:border-t-0" style={{ gridTemplateColumns }}>
                    <div className="sticky left-0 z-10 flex items-center border-r border-black/5 bg-white/90 px-3 py-3 text-sm text-slate-900 backdrop-blur-md">
                      <span className="truncate">{emp.name}</span>
                    </div>
                    {daysInMonth.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const empMap = shiftsByEmployeeAndDate.get(emp.id) ?? new Map<string, Shift[]>();
                      const dayShifts = empMap.get(dateKey) ?? [];
                      const inCurrentMonth = isSameMonth(day, monthDate);

                      return (
                        <div
                          key={`${emp.id}-${dateKey}`}
                          className={`border-l border-black/5 px-1.5 py-1.5 text-[11px] ${inCurrentMonth ? "bg-white/65" : "bg-[#f2f2f7] text-slate-500"}`}
                        >
                          {dayShifts.length === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <div className="space-y-1">
                              {dayShifts.slice(0, 3).map((shift) => (
                                <div
                                  key={shift.id}
                                  className={`glass-shift ${roleChipClass(shift.role)} flex cursor-pointer items-center justify-center border px-1.5 py-1 text-[10px] shadow-sm hover:ring-1 hover:ring-white/80`}
                                  onClick={() => openShiftModal(shift)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      openShiftModal(shift);
                                    }
                                  }}
                                  title={`${shift.employeeName} • ${shift.role} • ${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)}`}
                                >
                                  <span className="truncate">{shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}</span>
                                </div>
                              ))}
                              {dayShifts.length > 3 && <div className="text-center text-[10px] text-slate-500">+{dayShifts.length - 3}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-slate-500">Month Summary</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Total Shifts</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{monthSummary.totalShifts}</div>
          </div>
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Total Hours</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{monthSummary.totalHours.toFixed(1)}h</div>
          </div>
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Active Employees</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{monthSummary.activeEmployees}</div>
          </div>
          <div className="glass-muted rounded-xl border border-white/70 p-3">
            <div className="text-[11px] text-slate-600">Avg Shifts / Employee</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{monthSummary.averageShiftsPerEmployee.toFixed(1)}</div>
          </div>
        </div>
      </div>

      <Dialog open={addModalOpen} onOpenChange={(open) => !open && closeAddModal()}>
        <DialogContent className="glass-card max-w-md border-none bg-white/82">
          <DialogHeader>
            <DialogTitle className="font-mono text-slate-900">{t("schedule.addShift")}</DialogTitle>
            <DialogDescription className="text-xs text-slate-600">{monthLabel}</DialogDescription>
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
              <label className="mb-1 block text-xs text-slate-600">{t("label.name")}</label>
              <Select
                value={form.employeeId}
                onValueChange={(employeeId) => {
                  const employee = employees.find((item) => item.id === employeeId);
                  setForm((prev) => ({
                    ...prev,
                    employeeId,
                    role: employee?.role ?? prev.role,
                  }));
                }}
              >
                <SelectTrigger className="w-full border-white/80 bg-white/70 text-sm">
                  <SelectValue placeholder={t("label.name")} />
                </SelectTrigger>
                <SelectContent className="border-white/80 bg-white/85">
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">{t("label.startTime")}</label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="border-white/80 bg-white/70 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">{t("label.endTime")}</label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="border-white/80 bg-white/70 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="glass-button border-none bg-white/70 text-slate-900"
              onClick={closeAddModal}
              disabled={addSaving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="glass-button border-none bg-white/82 text-slate-900"
              onClick={handleCreateMonthShift}
              disabled={addSaving || !form.employeeId || !form.date || !form.startTime || !form.endTime}
            >
              {addSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("button.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftActionModal
        t={t}
        shift={selectedShift}
        open={shiftModalOpen}
        saving={modalSaving}
        deleting={modalDeleting}
        startTime={modalStartTime}
        endTime={modalEndTime}
        onStartTimeChange={setModalStartTime}
        onEndTimeChange={setModalEndTime}
        onClose={closeShiftModal}
        onSave={handleMonthShiftUpdate}
        onDelete={handleMonthShiftDelete}
      />
    </div>
  );
}

export default function ScheduleDashboardPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "day" ? "day" : searchParams.get("tab") === "week" ? "week" : "month";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className="mx-auto glass-chip bg-white/70 px-1">
        <TabsTrigger value="day">{t("tabs.day")}</TabsTrigger>
        <TabsTrigger value="week">{t("tabs.week")}</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>
      <TabsContent value="day"><DayScheduleView /></TabsContent>
      <TabsContent value="week"><WeekScheduleView /></TabsContent>
      <TabsContent value="month"><MonthScheduleView /></TabsContent>
    </Tabs>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

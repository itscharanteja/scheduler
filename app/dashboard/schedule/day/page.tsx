"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
  startOfWeek,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  createShift,
  getEmployees,
  getShiftsByWeek,
  isSupabaseConfigured,
  updateShift,
} from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const START_HOUR = 0;
const END_HOUR = 24;

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

function roleBarClass(role: string): string {
  switch (role) {
    case "shiftleader":
      return "bg-[#143038] text-[#dbe8ea] border-t-4 border-t-[#0b525c]";
    case "service":
      return "bg-[#2a1a1f] text-[#f4dee4] border-t-4 border-t-[#d98da2]";
    case "rutin":
      return "bg-[#1d2235] text-[#d9def8] border-t-4 border-t-[#6b7de3]";
    default:
      return "bg-[#242424] text-[#ececec] border-t-4 border-t-[#888]";
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function DaySchedulePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekParam = searchParams.get("week");
  const dateParam = searchParams.get("date");

  const weekStart = useMemo(() => parseWeekParam(weekParam), [weekParam]);
  const fallbackDay = format(weekStart, "yyyy-MM-dd");
  const selectedDay = dateParam ?? fallbackDay;
  const selectedDate = new Date(`${selectedDay}T00:00:00`);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dayShifts, setDayShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(selectedDay);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    employeeId: "",
    role: "service",
    startTime: "10:00",
    endTime: "18:00",
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    startTime: "10:00",
    endTime: "18:00",
    role: "service",
    notes: "",
  });

  useEffect(() => {
    let isActive = true;
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
        if (!isActive) return;
        setEmployees(employeeRows);
        setDayShifts(weekSchedule.shifts.filter((shift) => shift.date === selectedDay));
      } catch (err) {
        console.error(err);
        if (!isActive) return;
        setError(
          err instanceof Error ? err.message : "Failed to load day schedule."
        );
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [selectedDay, weekStart]);

  const dayIndex = useMemo(() => {
    const idx = format(selectedDate, "i");
    return Math.max(0, Math.min(6, Number(idx) - 1));
  }, [selectedDate]);

  const hourTicks = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i),
    []
  );
  const majorHourTicks = useMemo(
    () => hourTicks.filter((hour) => hour % 2 === 0 && hour <= 22),
    [hourTicks]
  );

  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    dayShifts.forEach((shift) => {
      const prev = map.get(shift.employeeId) ?? [];
      prev.push(shift);
      map.set(shift.employeeId, prev);
    });
    return map;
  }, [dayShifts]);

  const prevDay = subDays(selectedDate, 1);
  const nextDay = addDays(selectedDate, 1);

  useEffect(() => {
    setCalendarDate(selectedDay);
  }, [selectedDay]);

  useEffect(() => {
    if (employees.length === 0) return;
    setAddForm((prev) => ({
      ...prev,
      employeeId: prev.employeeId || employees[0].id,
      role: prev.role || employees[0].role,
    }));
  }, [employees]);

  function handleDateJump(value: string) {
    setCalendarDate(value);
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const week = toWeekParam(startOfWeek(date, { weekStartsOn: 1 }));
    router.push(`/dashboard/schedule/day?date=${value}&week=${week}`);
  }

  function openAddModal() {
    if (!employees.length) return;
    setAddForm({
      employeeId: employees[0].id,
      role: employees[0].role,
      startTime: "10:00",
      endTime: "18:00",
      notes: "",
    });
    setIsAddOpen(true);
  }

  function handleEmployeeChange(employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    setAddForm((prev) => ({
      ...prev,
      employeeId,
      role: employee?.role ?? prev.role,
    }));
  }

  function openEditModal(shift: Shift) {
    setEditingShift(shift);
    setEditForm({
      startTime: shift.startTime.slice(0, 5),
      endTime: shift.endTime.slice(0, 5),
      role: shift.role,
      notes: shift.notes ?? "",
    });
    setIsEditOpen(true);
  }

  async function handleAddShift() {
    if (!isSupabaseConfigured || !addForm.employeeId) return;
    setSaving(true);
    try {
      const employee = employees.find((item) => item.id === addForm.employeeId);
      const created = await createShift({
        employeeId: addForm.employeeId,
        date: selectedDay,
        startTime: addForm.startTime,
        endTime: addForm.endTime,
        role: addForm.role,
        locationId: employee?.locationId || LOCATION_ID,
        status: "draft",
        notes: addForm.notes || undefined,
      });
      setDayShifts((prev) => [...prev, created]);
      toast.success("Shift added");
      setIsAddOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save — try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditShift() {
    if (!isSupabaseConfigured || !editingShift) return;
    setSaving(true);
    try {
      const updated = await updateShift(editingShift.id, {
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        role: editForm.role,
        notes: editForm.notes || undefined,
      });
      setDayShifts((prev) =>
        prev.map((shift) => (shift.id === updated.id ? updated : shift))
      );
      toast.success("Shift added");
      setIsEditOpen(false);
      setEditingShift(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-[#2a2a2a] text-[#f0f0f0]" asChild>
            <Link href={`/dashboard/schedule/day?date=${format(prevDay, "yyyy-MM-dd")}&week=${toWeekParam(startOfWeek(prevDay, { weekStartsOn: 1 }))}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="font-mono text-sm text-[#f0f0f0]">
            {t(DAY_KEYS[dayIndex])}, {format(selectedDate, "d MMM yyyy")}
          </div>
          <Button variant="outline" size="sm" className="border-[#2a2a2a] text-[#f0f0f0]" asChild>
            <Link href={`/dashboard/schedule/day?date=${format(nextDay, "yyyy-MM-dd")}&week=${toWeekParam(startOfWeek(nextDay, { weekStartsOn: 1 }))}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#2a2a2a] text-[#f0f0f0]"
            onClick={openAddModal}
          >
            + {t("schedule.addShift")}
          </Button>
          <Input
            type="date"
            value={calendarDate}
            onChange={(e) => handleDateJump(e.target.value)}
            className="h-8 w-[160px] border-[#2a2a2a] bg-[#141414] text-xs text-[#f0f0f0]"
          />
          <Button variant="outline" size="sm" className="border-[#2a2a2a] text-[#f0f0f0]" asChild>
            <Link href={`/dashboard/schedule?week=${toWeekParam(weekStart)}`}>
              {t("tabs.week")}
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[#2a2a2a] bg-[#121212] p-3">
        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="mb-2 grid grid-cols-[220px_1fr] gap-0">
              <div />
              <div className="relative h-8 border border-[#2a2a2a] bg-[#161616]">
                {majorHourTicks.map((hour) => {
                  const leftPct = ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
                  return (
                    <div
                      key={`tick-${hour}`}
                      className="absolute top-0 h-full -translate-x-1/2 border-l border-[#303030]"
                      style={{ left: `${leftPct}%` }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#8a8a8a]">
                        {`${hour.toString().padStart(2, "0")}.00`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <div key={`skeleton-${idx}`} className="grid grid-cols-[220px_1fr]">
                    <div className="h-20 border border-[#2a2a2a] bg-[#151515]" />
                    <div className="h-20 border border-[#2a2a2a] bg-[#151515]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0">
                {employees.map((employee) => {
                  const employeeShifts = shiftsByEmployee.get(employee.id) ?? [];
                  return (
                    <div key={employee.id} className="grid grid-cols-[220px_1fr]">
                      <div className="flex items-center border border-[#2a2a2a] bg-[#151515] px-4 py-4">
                        <span className="truncate text-base text-[#e6e6e6]">{employee.name}</span>
                      </div>
                      <div className="relative h-[82px] border border-[#2a2a2a] bg-[#141414]">
                        {majorHourTicks.map((hour) => {
                          const leftPct = ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
                          return (
                            <div
                              key={`grid-${employee.id}-${hour}`}
                              className="absolute top-0 h-full border-l border-[#292929]"
                              style={{ left: `${leftPct}%` }}
                            />
                          );
                        })}

                        {employeeShifts.map((shift) => {
                          const totalMinutes = (END_HOUR - START_HOUR) * 60;
                          const startMinutes = Math.max(timeToMinutes(shift.startTime), START_HOUR * 60);
                          const endMinutes = Math.min(timeToMinutes(shift.endTime), END_HOUR * 60);
                          const leftPct = ((startMinutes - START_HOUR * 60) / totalMinutes) * 100;
                          const widthPct = ((endMinutes - startMinutes) / totalMinutes) * 100;

                          return (
                            <div
                              key={shift.id}
                              className={`${roleBarClass(shift.role)} absolute top-2 h-[62px] cursor-pointer rounded-md px-3 py-2`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${Math.max(widthPct, 9)}%`,
                              }}
                              onClick={() => openEditModal(shift)}
                              title={t("schedule.editShift")}
                            >
                              <div className="text-xs opacity-80">
                                {shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}
                              </div>
                              <div className="text-base leading-tight">{shift.role}</div>
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md border-[#2a2a2a] bg-[#141414]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {t("schedule.addShift")}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888]">
              {format(selectedDate, "d MMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#888]">{t("label.name")}</label>
              <Select value={addForm.employeeId} onValueChange={handleEmployeeChange}>
                <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                  <SelectValue placeholder={t("label.name")} />
                </SelectTrigger>
                <SelectContent className="border-[#2a2a2a] bg-[#141414]">
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
                <label className="mb-1 block text-xs text-[#888]">{t("label.startTime")}</label>
                <Input
                  type="time"
                  value={addForm.startTime}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#888]">{t("label.endTime")}</label>
                <Input
                  type="time"
                  value={addForm.endTime}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">{t("label.role")}</label>
              <Select
                value={addForm.role}
                onValueChange={(value) => setAddForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                  <SelectItem value="service">{t("role.service")}</SelectItem>
                  <SelectItem value="shiftleader">{t("role.shiftleader")}</SelectItem>
                  <SelectItem value="rutin">{t("role.rutin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">{t("label.notes")}</label>
              <Input
                value={addForm.notes}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={() => setIsAddOpen(false)}
              disabled={saving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-[#e8b84b] text-black hover:bg-[#f0c75c]"
              onClick={handleAddShift}
              disabled={saving}
            >
              {t("button.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingShift(null);
        }}
      >
        <DialogContent className="max-w-md border-[#2a2a2a] bg-[#141414]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {t("schedule.editShift")}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888]">
              {format(selectedDate, "d MMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#888]">{t("label.startTime")}</label>
                <Input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#888]">{t("label.endTime")}</label>
                <Input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">{t("label.role")}</label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="w-full border-[#2a2a2a] bg-[#0f0f0f] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#2a2a2a] bg-[#141414]">
                  <SelectItem value="service">{t("role.service")}</SelectItem>
                  <SelectItem value="shiftleader">{t("role.shiftleader")}</SelectItem>
                  <SelectItem value="rutin">{t("role.rutin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">{t("label.notes")}</label>
              <Input
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="border-[#2a2a2a] bg-[#0f0f0f] text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={() => {
                setIsEditOpen(false);
                setEditingShift(null);
              }}
              disabled={saving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-[#e8b84b] text-black hover:bg-[#f0c75c]"
              onClick={handleEditShift}
              disabled={saving}
            >
              {t("button.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

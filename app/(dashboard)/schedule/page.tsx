"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
} from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOCATION_ID } from "@/lib/constants";
import {
  createShift,
  deleteShift,
  getEmployees,
  getShiftsByWeek,
  updateShift,
} from "@/lib/supabase";
import type { Employee, Shift, WeatherForecastDay } from "@/lib/types";

function parseWeekParam(weekParam: string | null): Date {
  const match = weekParam?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeek(new Date(), { weekStartsOn: 1 });
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const yearAdjusted = setISOWeekYear(new Date(), year);
  const weekAdjusted = setISOWeek(yearAdjusted, week);
  return startOfWeek(weekAdjusted, { weekStartsOn: 1 });
}

function toWeekParam(date: Date): string {
  const y = getISOWeekYear(date);
  const w = getISOWeek(date);
  return `${y}-W${w.toString().padStart(2, "0")}`;
}

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

type ShiftForm = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
};

const emptyForm: ShiftForm = {
  employeeId: "",
  date: "",
  startTime: "10:00",
  endTime: "18:00",
  role: "service",
};

function shiftStatusClass(shift: Shift) {
  if (shift.createdByAi) return "status-info";
  if (shift.status === "published") return "status-success";
  return "status-neutral";
}

function SchedulePageContent() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "super_admin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = useMemo(() => parseWeekParam(searchParams.get("week")), [searchParams]);
  const tab = searchParams.get("tab") === "day" ? "day" : "week";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weather, setWeather] = useState<WeatherForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftForm>(emptyForm);

  const dayParam = searchParams.get("date");
  const selectedDay = dayParam ?? format(weekStart, "yyyy-MM-dd");

  const text =
    lang === "sv"
      ? {
          addShift: "Lägg till pass",
          save: "Spara pass",
          delete: "Ta bort pass",
          coverage: "Täckning",
          conflicts: "Konflikter",
          hours: "Planerade timmar",
          gaps: "Bemanningsluckor",
          week: "Vecka",
          day: "Dag",
          ai: "AI-förslag",
        }
      : {
          addShift: "Add shift",
          save: "Save shift",
          delete: "Delete shift",
          coverage: "Coverage",
          conflicts: "Conflicts",
          hours: "Planned hours",
          gaps: "Coverage gaps",
          week: "Week",
          day: "Day",
          ai: "AI suggestion",
        };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [employeeRows, schedule, weatherRes] = await Promise.all([
          getEmployees(),
          getShiftsByWeek(weekStart, LOCATION_ID),
          fetch(`/api/weather?locationId=${LOCATION_ID}`).then((r) => r.json()).catch(() => ({ forecasts: [] })),
        ]);
        if (!active) return;
        setEmployees(employeeRows);
        setShifts(schedule.shifts);
        setWeather(Array.isArray(weatherRes.forecasts) ? weatherRes.forecasts.slice(0, 3) : []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const existing = map.get(shift.date) ?? [];
      existing.push(shift);
      map.set(shift.date, existing.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [shifts]);

  const selectedDayShifts = shiftsByDay.get(selectedDay) ?? [];
  const totalHours = shifts.reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
  const dayConflicts = useMemo(() => {
    let count = 0;
    for (const day of weekDays) {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayShifts = (shiftsByDay.get(dayKey) ?? []).slice().sort((a, b) => `${a.employeeId}${a.startTime}`.localeCompare(`${b.employeeId}${b.startTime}`));
      for (let i = 1; i < dayShifts.length; i++) {
        const previous = dayShifts[i - 1];
        const current = dayShifts[i];
        if (previous.employeeId === current.employeeId && previous.endTime > current.startTime) {
          count += 1;
        }
      }
    }
    return count;
  }, [shiftsByDay, weekDays]);

  const coverageGaps = weekDays.filter((day) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const dayShifts = shiftsByDay.get(dayKey) ?? [];
    const hasLeader = dayShifts.some((shift) => shift.role === "shiftleader");
    return !hasLeader || dayShifts.length < 4;
  }).length;

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => params.set(key, value));
    router.push(`/schedule?${params.toString()}`);
  }

  function openCreate(day: string) {
    setEditingShiftId(null);
    setForm({
      employeeId: employees[0]?.id ?? "",
      date: day,
      startTime: "10:00",
      endTime: "18:00",
      role: employees[0]?.role ?? "service",
    });
    setFormOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditingShiftId(shift.id);
    setForm({
      employeeId: shift.employeeId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      role: shift.role,
    });
    setFormOpen(true);
  }

  async function saveShift() {
    if (!form.employeeId) return;
    setSaving(true);
    try {
      if (editingShiftId) {
        const updated = await updateShift(editingShiftId, {
          employeeId: form.employeeId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          role: form.role,
        });
        setShifts((prev) => prev.map((shift) => (shift.id === editingShiftId ? updated : shift)));
        toast.success("Shift updated");
      } else {
        const employee = employees.find((item) => item.id === form.employeeId);
        const created = await createShift({
          employeeId: form.employeeId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          role: form.role,
          locationId: employee?.locationId ?? LOCATION_ID,
          status: "draft",
        });
        setShifts((prev) => [...prev, created]);
        toast.success("Shift added");
      }
      setFormOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Could not save shift");
    } finally {
      setSaving(false);
    }
  }

  async function removeShift() {
    if (!editingShiftId) return;
    setSaving(true);
    try {
      await deleteShift(editingShiftId);
      setShifts((prev) => prev.filter((shift) => shift.id !== editingShiftId));
      setFormOpen(false);
      toast.success("Shift deleted");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete shift");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={canEdit ? "grid gap-4 xl:grid-cols-[1.15fr_0.85fr]" : ""}>
        <div className="app-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="toolbar-row">
              <Button variant="outline" size="sm" onClick={() => updateQuery({ week: toWeekParam(addDays(weekStart, -7)) })}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="status-chip status-neutral">
                {text.week} {getISOWeek(weekStart)} • {format(weekStart, "d MMM")} - {format(addDays(weekStart, 6), "d MMM")}
              </div>
              <Button variant="outline" size="sm" onClick={() => updateQuery({ week: toWeekParam(addDays(weekStart, 7)) })}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="toolbar-row">
              <Button variant={tab === "week" ? "default" : "outline"} size="sm" onClick={() => updateQuery({ tab: "week" })}>
                {text.week}
              </Button>
              <Button variant={tab === "day" ? "default" : "outline"} size="sm" onClick={() => updateQuery({ tab: "day", date: selectedDay })}>
                {text.day}
              </Button>
              {canEdit && (
                <Button onClick={() => openCreate(selectedDay)}>
                  <Plus className="h-4 w-4" />
                  {text.addShift}
                </Button>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="metric-card">
                <div className="metric-label">{text.hours}</div>
                <div className="metric-value">{totalHours.toFixed(1)}h</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">{text.conflicts}</div>
                <div className="metric-value">{dayConflicts}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">{text.gaps}</div>
                <div className="metric-value">{coverageGaps}</div>
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="app-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{text.ai}</h2>
                <p className="section-copy">
                  {lang === "sv"
                    ? "AI-förslag ska ligga nära schemat, inte gömmas långt bort."
                    : "AI recommendations should sit next to the schedule, not hide elsewhere."}
                </p>
              </div>
              <span className="status-chip status-info">
                <Sparkles className="h-3.5 w-3.5" />
                AI
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="text-sm font-semibold text-slate-950">
                {lang === "sv"
                  ? "Lägg till en extra serviceperson fredag 18:00-20:00."
                  : "Add one more service teammate Friday 18:00-20:00."}
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {lang === "sv"
                  ? "Middagsintensiteten och vädret pekar på högre tryck än normalnivå."
                  : "Dinner traffic and weather signals point to higher demand than usual."}
              </div>
              <div className="mt-4">
                <Button asChild size="sm">
                  <Link href="/ai-agent">{lang === "sv" ? "Öppna AI-optimering" : "Open AI Optimisation"}</Link>
                </Button>
              </div>
            </div>
            <div className="mt-4 list-block">
              {weather.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500">
                  {lang === "sv" ? "Ingen väderdata tillgänglig." : "No weather data available."}
                </div>
              ) : (
                weather.map((day) => (
                  <div key={day.date} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">{day.date}</div>
                      <div className="list-row-copy">{day.summary}</div>
                    </div>
                    <span className="status-chip status-neutral">{day.tempHigh}°</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {tab === "week" ? (
        <section className="app-panel overflow-hidden">
          <div className="grid gap-px bg-slate-200 xl:grid-cols-7">
            {weekDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayShifts = shiftsByDay.get(dayKey) ?? [];
              const gap = !dayShifts.some((shift) => shift.role === "shiftleader") || dayShifts.length < 4;
              return (
                <div key={dayKey} className="bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{format(day, "EEE d MMM")}</div>
                      <div className="mt-1 text-xs text-slate-500">{dayShifts.length} shifts</div>
                    </div>
                    {gap ? (
                      <span className="status-chip status-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Gap
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 list-block">
                    {dayShifts.map((shift) =>
                      canEdit ? (
                        <button key={shift.id} type="button" className="list-row text-left" onClick={() => openEdit(shift)}>
                          <div className="list-row-main">
                            <div className="list-row-title">{shift.employeeName || shift.employeeId}</div>
                            <div className="list-row-copy">{shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)} • {shift.role}</div>
                          </div>
                          <span className={`status-chip ${shiftStatusClass(shift)}`}>{shift.status}</span>
                        </button>
                      ) : (
                        <div key={shift.id} className="list-row">
                          <div className="list-row-main">
                            <div className="list-row-title">{shift.employeeName || shift.employeeId}</div>
                            <div className="list-row-copy">{shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)} • {shift.role}</div>
                          </div>
                          <span className={`status-chip ${shiftStatusClass(shift)}`}>{shift.status}</span>
                        </div>
                      )
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => openCreate(dayKey)}>
                        <Plus className="h-4 w-4" />
                        {text.addShift}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="app-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">{format(new Date(`${selectedDay}T00:00:00`), "EEEE d MMMM")}</h2>
              <p className="section-copy">
                {lang === "sv"
                  ? "Fokuserad dagsvy för snabba ändringar och bemanningskontroll."
                  : "Focused day view for quick changes and coverage checks."}
              </p>
            </div>
            <Input
              type="date"
              value={selectedDay}
              onChange={(event) => updateQuery({ tab: "day", date: event.target.value, week: toWeekParam(startOfWeek(new Date(`${event.target.value}T00:00:00`), { weekStartsOn: 1 })) })}
              className="w-[180px]"
            />
          </div>
          <div className="mt-4 list-block">
            {loading ? (
              <div className="app-panel-muted px-4 py-8 text-sm text-slate-600">Loading schedule...</div>
            ) : selectedDayShifts.length === 0 ? (
              <div className="app-panel-muted px-4 py-10 text-center text-sm text-slate-600">No shifts planned for this day.</div>
            ) : (
              selectedDayShifts.map((shift) => (
                <div key={shift.id} className="list-row">
                  <div className="list-row-main">
                    <div className="list-row-title">{shift.employeeName}</div>
                    <div className="list-row-copy">{shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)} • {shift.role}</div>
                  </div>
                  <div className="toolbar-row">
                    <span className={`status-chip ${shiftStatusClass(shift)}`}>{shift.status}</span>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(shift)}>Edit</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {canEdit && <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShiftId ? "Edit shift" : text.addShift}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <select
              value={form.employeeId}
              onChange={(event) => {
                const employee = employees.find((item) => item.id === event.target.value);
                setForm((prev) => ({
                  ...prev,
                  employeeId: event.target.value,
                  role: employee?.role ?? prev.role,
                }));
              }}
              className="filter-input"
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} />
              <Input type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} />
            </div>
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              className="filter-input"
            >
              <option value="service">Service</option>
              <option value="shiftleader">Shift leader</option>
              <option value="rutin">Rutin</option>
            </select>
          </div>
          <DialogFooter className="gap-2">
            {editingShiftId ? (
              <Button variant="outline" onClick={() => void removeShift()} disabled={saving}>
                {text.delete}
              </Button>
            ) : null}
            <Button onClick={() => void saveShift()} disabled={saving}>
              {text.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SchedulePageContent />
    </Suspense>
  );
}

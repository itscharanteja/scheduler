"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import {
  createShift,
  deleteShift,
  getEmployees,
  getShiftsByWeek,
  updateShift,
} from "@/lib/supabase";
import type { Employee, Shift, WeatherForecast } from "@/lib/types";

// ─── Time / Gantt helpers ──────────────────────────────────────────────────────

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

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

const HOUR_START = 6;
const HOUR_END = 24;
const TOTAL_MINS = (HOUR_END - HOUR_START) * 60;
const HOUR_TICKS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

function toLeftPct(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Math.max(0, Math.min(100, ((h * 60 + m - HOUR_START * 60) / TOTAL_MINS) * 100));
}

function toWidthPct(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0.5, (((eh * 60 + em) - (sh * 60 + sm)) / TOTAL_MINS) * 100);
}

// ─── Role palette ──────────────────────────────────────────────────────────────

const ROLE_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  service:     { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  shiftleader: { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  rutin:       { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  sales:       { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  reception:   { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
};

function rolePalette(role: string) {
  return ROLE_PALETTE[role.toLowerCase()] ?? { bg: "#ede9fe", text: "#4338ca", border: "#a5b4fc" };
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#06B6D4",
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── AI suggestion inline row ─────────────────────────────────────────────────

function AiSuggestionRow({ weather, label }: { weather: WeatherForecast[]; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[13px] font-semibold text-slate-700">{label}</span>
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
            {weather.length}
          </span>
        </div>
        <ChevronRight
          className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-200 divide-y divide-slate-100">
          {weather.map((day) => (
            <div key={day.forecastDate} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-800">
                  {day.day} — {day.forecastDate}
                </div>
                <div className="mt-0.5 text-[12px] text-slate-500">{day.staffingSuggestion}</div>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {day.temperatureHigh}°
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter popover ──────────────────────────────────────────────────────────

function FilterPopover({
  employees,
  filterEmployeeIds,
  filterRoles,
  onToggleEmployee,
  onToggleRole,
  onClear,
}: {
  employees: Employee[];
  filterEmployeeIds: Set<string>;
  filterRoles: Set<string>;
  onToggleEmployee: (id: string) => void;
  onToggleRole: (role: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const activeCount = filterEmployeeIds.size + filterRoles.size;

  const visibleEmployees = search.trim()
    ? employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : employees;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-1.5"
          style={activeCount > 0 ? { borderColor: "#94a3b8", background: "#f8fafc" } : undefined}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-800">Filters</span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>

        {/* Role section */}
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Role</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ROLE_PALETTE).map(([role, pal]) => {
              const active = filterRoles.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => onToggleRole(role)}
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-all"
                  style={
                    active
                      ? { backgroundColor: pal.bg, color: pal.text, borderColor: pal.border }
                      : { backgroundColor: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }
                  }
                >
                  {active && <span className="mr-1">✓</span>}
                  {role}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="mb-3 border-t border-slate-100" />

        {/* Person section */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Person</p>
          {employees.length > 6 && (
            <input
              type="text"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          )}
          <div className="max-h-44 overflow-y-auto">
            {visibleEmployees.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-slate-400">No results</p>
            ) : (
              visibleEmployees.map((emp) => {
                const checked = filterEmployeeIds.has(emp.id);
                const bg = avatarColor(emp.name);
                return (
                  <label
                    key={emp.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleEmployee(emp.id)}
                      className="h-3.5 w-3.5 rounded accent-slate-800"
                    />
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: bg }}
                    >
                      {initials(emp.name)}
                    </div>
                    <span className="flex-1 text-[13px] text-slate-700">{emp.name}</span>
                    <span className="text-[11px] capitalize text-slate-400">{emp.role}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Gantt row ────────────────────────────────────────────────────────────────

function GanttRow({
  employee,
  dayShifts,
  canEdit,
  selectedDay,
  employees,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  employee: Employee;
  dayShifts: Shift[];
  canEdit: boolean;
  selectedDay: string;
  employees: Employee[];
  onCreated: (form: ShiftForm) => Promise<void>;
  onUpdated: (shiftId: string, form: ShiftForm) => Promise<void>;
  onDeleted: (shiftId: string) => Promise<void>;
}) {
  const bg = avatarColor(employee.name);
  const inits = initials(employee.name);
  const hasShifts = dayShifts.length > 0;

  return (
    <div
      className="flex items-stretch border-b border-slate-100 last:border-0"
      style={{ opacity: hasShifts ? 1 : 0.55 }}
    >
      {/* Employee label column */}
      <div className="flex shrink-0 items-center gap-2.5 border-r border-slate-100 bg-white px-4 py-2"
        style={{ width: 220, minWidth: 220 }}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: bg }}
        >
          {inits}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-800">{employee.name}</div>
          <div className="truncate text-[11px] capitalize text-slate-400">{employee.role}</div>
        </div>
        {canEdit && (
          <ShiftPopover
            trigger={
              <button
                type="button"
                className="shrink-0 rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Add shift"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            }
            title={`Add shift — ${employee.name}`}
            employees={employees}
            defaultForm={{ employeeId: employee.id, date: selectedDay, startTime: "10:00", endTime: "18:00", role: employee.role ?? "service" }}
            onSave={onCreated}
          />
        )}
      </div>

      {/* Timeline column */}
      <div className="relative flex-1 bg-slate-50" style={{ height: 56 }}>
        {/* Hour grid lines */}
        {HOUR_TICKS.map((h) => (
          <div
            key={h}
            className="absolute inset-y-0 border-l border-slate-200"
            style={{ left: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}
          />
        ))}

        {/* Shift bars */}
        {dayShifts.map((shift) => {
          const pal = rolePalette(shift.role);
          const left = toLeftPct(shift.startTime);
          const width = toWidthPct(shift.startTime, shift.endTime);
          const barContent = (
            <div
              className="absolute flex items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold"
              style={{
                top: 8,
                bottom: 8,
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: pal.bg,
                color: pal.text,
                border: `1px solid ${pal.border}`,
              }}
            >
              <span className="truncate">
                {shift.role}&nbsp;·&nbsp;{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
              </span>
            </div>
          );

          if (!canEdit) return <React.Fragment key={shift.id}>{barContent}</React.Fragment>;

          return (
            <ShiftPopover
              key={shift.id}
              trigger={
                <button
                  type="button"
                  className="absolute transition-opacity hover:opacity-75"
                  style={{ top: 8, bottom: 8, left: `${left}%`, width: `${width}%` }}
                  title={`${employee.name}: ${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)} · ${shift.role}`}
                >
                  <div
                    className="flex h-full w-full items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold"
                    style={{ backgroundColor: pal.bg, color: pal.text, border: `1px solid ${pal.border}` }}
                  >
                    <span className="truncate">
                      {shift.role}&nbsp;·&nbsp;{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                    </span>
                  </div>
                </button>
              }
              title={`Edit shift — ${employee.name}`}
              employees={employees}
              editingShiftId={shift.id}
              defaultForm={{ employeeId: shift.employeeId, date: shift.date, startTime: shift.startTime, endTime: shift.endTime, role: shift.role }}
              onSave={(form) => onUpdated(shift.id, form)}
              onDelete={() => onDeleted(shift.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftForm = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
};

// ─── Shift form popover ───────────────────────────────────────────────────────

function ShiftPopover({
  trigger,
  title,
  employees,
  defaultForm,
  editingShiftId = null,
  onSave,
  onDelete,
}: {
  trigger: React.ReactNode;
  title: string;
  employees: Employee[];
  defaultForm: ShiftForm;
  editingShiftId?: string | null;
  onSave: (form: ShiftForm) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ShiftForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) setForm(defaultForm);
    setOpen(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="mb-3 text-[13px] font-semibold text-slate-800">{title}</p>
        <div className="grid gap-2">
          <select
            value={form.employeeId}
            onChange={(e) => {
              const emp = employees.find((em) => em.id === e.target.value);
              setForm((prev) => ({ ...prev, employeeId: e.target.value, role: emp?.role ?? prev.role }));
            }}
            className="filter-input text-sm"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <Input type="date" value={form.date} className="h-10 text-sm" onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={form.startTime} className="h-10 text-sm" onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} />
            <Input type="time" value={form.endTime} className="h-10 text-sm" onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
          </div>
          <select
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            className="filter-input text-sm"
          >
            <option value="service">Service</option>
            <option value="shiftleader">Shift leader</option>
            <option value="rutin">Rutin</option>
            <option value="sales">Sales</option>
            <option value="reception">Reception</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {editingShiftId && onDelete && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void handleDelete()}>
              Delete
            </Button>
          )}
          <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
            {editingShiftId ? "Save" : "Add shift"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SchedulePageContent() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const { locationId } = useLocation();
  const canEdit = hasRole("admin", "super_admin");
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekStart = useMemo(() => parseWeekParam(searchParams.get("week")), [searchParams]);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayParam = searchParams.get("date");
  // Default to today, not week-start Monday
  const selectedDay = dayParam ?? todayStr;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterEmployeeIds, setFilterEmployeeIds] = useState<Set<string>>(new Set());
  const [filterRoles, setFilterRoles] = useState<Set<string>>(new Set());

  function toggleEmployeeFilter(id: string) {
    setFilterEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleRoleFilter(role: string) {
    setFilterRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

  function clearFilters() {
    setFilterEmployeeIds(new Set());
    setFilterRoles(new Set());
  }

  const t = lang === "sv"
    ? { addShift: "Lägg till pass", save: "Spara pass", delete: "Ta bort pass", hours: "Planerade timmar", conflicts: "Konflikter", gaps: "Bemanningsluckor", week: "Vecka", ai: "AI-förslag", noShifts: "Inga pass planerade." }
    : { addShift: "Add shift", save: "Save shift", delete: "Delete shift", hours: "Planned hours", conflicts: "Conflicts", gaps: "Coverage gaps", week: "Week", ai: "AI suggestion", noShifts: "No shifts planned." };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [emps, schedule, weatherRes] = await Promise.all([
          getEmployees(locationId),
          getShiftsByWeek(weekStart, locationId),
          fetch(`/api/weather?locationId=${locationId}`).then((r) => r.json()).catch(() => ({ forecasts: [] })),
        ]);
        if (!active) return;
        setEmployees(emps);
        setShifts(schedule.shifts);
        setWeather(Array.isArray(weatherRes.forecasts) ? weatherRes.forecasts.slice(0, 3) : []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [weekStart]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const existing = map.get(s.date) ?? [];
      existing.push(s);
      map.set(s.date, existing.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [shifts]);

  const selectedDayShifts = shiftsByDay.get(selectedDay) ?? [];
  const totalHours = shifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);

  const dayConflicts = useMemo(() => {
    let count = 0;
    for (const day of weekDays) {
      const dayShifts = (shiftsByDay.get(format(day, "yyyy-MM-dd")) ?? [])
        .slice().sort((a, b) => `${a.employeeId}${a.startTime}`.localeCompare(`${b.employeeId}${b.startTime}`));
      for (let i = 1; i < dayShifts.length; i++) {
        if (dayShifts[i - 1].employeeId === dayShifts[i].employeeId && dayShifts[i - 1].endTime > dayShifts[i].startTime) count++;
      }
    }
    return count;
  }, [shiftsByDay, weekDays]);

  const coverageGaps = weekDays.filter((day) => {
    const ds = shiftsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
    return !ds.some((s) => s.role === "shiftleader") || ds.length < 4;
  }).length;

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([k, v]) => params.set(k, v));
    router.push(`/schedule?${params.toString()}`);
  }

  async function handleCreate(form: ShiftForm) {
    const emp = employees.find((e) => e.id === form.employeeId);
    const created = await createShift({ employeeId: form.employeeId, date: form.date, startTime: form.startTime, endTime: form.endTime, role: form.role, locationId: emp?.locationId ?? locationId, status: "draft" });
    setShifts((prev) => [...prev, created]);
    toast.success("Shift added");
  }

  async function handleUpdate(shiftId: string, form: ShiftForm) {
    const updated = await updateShift(shiftId, { employeeId: form.employeeId, date: form.date, startTime: form.startTime, endTime: form.endTime, role: form.role });
    setShifts((prev) => prev.map((s) => (s.id === shiftId ? updated : s)));
    toast.success("Shift updated");
  }

  async function handleDelete(shiftId: string) {
    await deleteShift(shiftId);
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    toast.success("Shift deleted");
  }

  // Base list: employees who have at least one shift this week
  const weekEmployees = useMemo(() => {
    const withShiftsThisWeek = new Set(shifts.map((s) => s.employeeId));
    const withShiftsToday = new Set(selectedDayShifts.map((s) => s.employeeId));
    return employees
      .filter((e) => withShiftsThisWeek.has(e.id))
      .sort((a, b) => {
        const aToday = withShiftsToday.has(a.id);
        const bToday = withShiftsToday.has(b.id);
        if (aToday && !bToday) return -1;
        if (!aToday && bToday) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [employees, shifts, selectedDayShifts]);

  // Apply employee filter
  const sortedEmployees = useMemo(() => {
    if (filterEmployeeIds.size === 0) return weekEmployees;
    return weekEmployees.filter((e) => filterEmployeeIds.has(e.id));
  }, [weekEmployees, filterEmployeeIds]);

  // Shifts for selected day, grouped by employee, with role filter applied
  const selectedDayShiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of selectedDayShifts) {
      if (filterRoles.size > 0 && !filterRoles.has(s.role)) continue;
      const existing = map.get(s.employeeId) ?? [];
      existing.push(s);
      map.set(s.employeeId, existing);
    }
    return map;
  }, [selectedDayShifts, filterRoles]);

  const dayTotalHours = selectedDayShifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);

  return (
    <div className="space-y-4">
      {/* ── Header panel ── */}
      <div className="app-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="toolbar-row">
            <Button variant="outline" size="sm" onClick={() => {
              const prev = addDays(weekStart, -7);
              updateQuery({ week: toWeekParam(prev), date: format(prev, "yyyy-MM-dd") });
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="status-chip status-neutral">
              {t.week} {getISOWeek(weekStart)} · {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM")}
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const next = addDays(weekStart, 7);
              updateQuery({ week: toWeekParam(next), date: format(next, "yyyy-MM-dd") });
            }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="toolbar-row">
            <FilterPopover
              employees={weekEmployees}
              filterEmployeeIds={filterEmployeeIds}
              filterRoles={filterRoles}
              onToggleEmployee={toggleEmployeeFilter}
              onToggleRole={toggleRoleFilter}
              onClear={clearFilters}
            />
            {canEdit && (
              <ShiftPopover
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    {t.addShift}
                  </Button>
                }
                title={t.addShift}
                employees={employees}
                defaultForm={{ employeeId: employees[0]?.id ?? "", date: selectedDay, startTime: "10:00", endTime: "18:00", role: employees[0]?.role ?? "service" }}
                onSave={handleCreate}
              />
            )}
          </div>
        </div>

        {/* Day strip */}
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const isSelected = key === selectedDay;
            const isToday = key === todayStr;
            const dayShiftCount = (shiftsByDay.get(key) ?? []).length;
            const hasGap = !(shiftsByDay.get(key) ?? []).some((s) => s.role === "shiftleader") || dayShiftCount < 4;
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateQuery({ date: key, week: toWeekParam(weekStart) })}
                className={`flex min-w-[58px] flex-col items-center rounded-xl px-2.5 py-2 transition-colors ${
                  isSelected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className={`text-[11px] font-medium ${isSelected ? "text-slate-400" : "text-slate-400"}`}>
                  {format(day, "EEE")}
                </span>
                <span className={`mt-0.5 text-[15px] font-bold ${isToday && !isSelected ? "text-blue-600" : ""}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1.5 flex items-center gap-0.5">
                  {dayShiftCount > 0
                    ? Array.from({ length: Math.min(dayShiftCount, 4) }).map((_, idx) => (
                        <div key={idx} className={`h-1 w-1 rounded-full ${isSelected ? "bg-white/60" : "bg-slate-400"}`} />
                      ))
                    : <div className={`h-1 w-1 rounded-full ${isSelected ? "bg-white/20" : "bg-slate-200"}`} />}
                </div>
                {hasGap && !isSelected && (
                  <AlertTriangle className="mt-1 h-2.5 w-2.5 text-amber-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        {canEdit && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="metric-card">
              <div className="metric-label">{t.hours}</div>
              <div className="metric-value">{totalHours.toFixed(1)}h</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{t.conflicts}</div>
              <div className="metric-value">{dayConflicts}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{t.gaps}</div>
              <div className="metric-value">{coverageGaps}</div>
            </div>
          </div>
        )}

        {/* AI suggestion — collapsed by default, expands inline */}
        {canEdit && weather.length > 0 && <AiSuggestionRow weather={weather} label={t.ai} />}
      </div>

      {/* ── Gantt chart ── */}
      <div className="app-panel overflow-hidden">
        {/* Gantt header */}
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">{format(new Date(`${selectedDay}T00:00:00`), "EEEE, d MMMM")}</h2>
              {!loading && (
                <p className="section-copy mt-0.5">
                  {selectedDayShifts.length} {selectedDayShifts.length === 1 ? "shift" : "shifts"} · {dayTotalHours.toFixed(1)}h total
                </p>
              )}
            </div>
            {/* Role legend */}
            <div className="hidden items-center gap-2 sm:flex">
              {Object.entries(ROLE_PALETTE).map(([role, pal]) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize"
                  style={{ backgroundColor: pal.bg, color: pal.text, borderColor: pal.border }}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
          {/* Active filter chips */}
          {(filterEmployeeIds.size > 0 || filterRoles.size > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Showing:</span>
              {Array.from(filterEmployeeIds).map((id) => {
                const emp = employees.find((e) => e.id === id);
                if (!emp) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleEmployeeFilter(id)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                  >
                    {emp.name}
                    <X className="h-2.5 w-2.5" />
                  </button>
                );
              })}
              {Array.from(filterRoles).map((role) => {
                const pal = ROLE_PALETTE[role] ?? { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRoleFilter(role)}
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize"
                    style={{ backgroundColor: pal.bg, color: pal.text, borderColor: pal.border }}
                  >
                    {role}
                    <X className="h-2.5 w-2.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-14 text-center text-sm text-slate-400">Loading schedule…</div>
        ) : (
          <div className="overflow-x-auto">
            {/* Time header row */}
            <div className="flex border-b border-slate-200 bg-slate-50/80" style={{ minWidth: 820 }}>
              <div className="shrink-0 border-r border-slate-100 px-4 py-2" style={{ width: 220, minWidth: 220 }}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employee</span>
              </div>
              <div className="relative flex-1" style={{ height: 28 }}>
                {HOUR_TICKS.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 flex h-full items-center"
                    style={{ left: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}
                  >
                    <span className="pl-1 text-[10px] text-slate-400">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Employee rows */}
            <div style={{ minWidth: 820 }}>
              {sortedEmployees.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-400">{t.noShifts}</div>
              ) : (
                sortedEmployees.map((emp) => (
                  <GanttRow
                    key={emp.id}
                    employee={emp}
                    dayShifts={selectedDayShiftsByEmployee.get(emp.id) ?? []}
                    canEdit={canEdit}
                    selectedDay={selectedDay}
                    employees={employees}
                    onCreated={handleCreate}
                    onUpdated={handleUpdate}
                    onDeleted={handleDelete}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>



    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <SchedulePageContent />
    </Suspense>
  );
}

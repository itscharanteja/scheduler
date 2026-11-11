"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
import Link from "next/link";
import { AlertTriangle, Bot, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { AiSuggestionRow } from "./ai-suggestion-row";
import { ShiftPopover, type ShiftForm } from "./shift-popover";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLocation } from "@/context/LocationContext";
import { useShellData } from "@/components/app-shell";
import { useCachedQuery } from "@/lib/cache/swr-cache";
import {
  createShift,
  deleteShift,
  getShiftsByWeek,
  updateShift,
} from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";
import type { AttendanceSessionWithEmployee } from "@/lib/supabase/attendance";

const NO_SHIFTS: Shift[] = [];

const GanttScheduleCanvas = dynamic(
  () => import("./gantt-schedule-canvas"),
  { ssr: false, loading: () => <DashboardSkeleton type="gantt-canvas" /> }
);

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

// ─── Role palette ──────────────────────────────────────────────────────────────

const ROLE_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  service:     { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  shiftleader: { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  rutin:       { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  sales:       { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  reception:   { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
};

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

// ─── Page ─────────────────────────────────────────────────────────────────────

function SchedulePageContent() {
  const { lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const { locationId } = useLocation();
  const canEdit = hasRole("admin", "super_admin");
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekStart = useMemo(() => parseWeekParam(searchParams.get("week")), [searchParams]);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayParam = searchParams.get("date");
  // Default to today, not week-start Monday
  const selectedDay = dayParam ?? todayStr;

  const { employees } = useShellData();
  const [isShiftEditing, setIsShiftEditing] = useState(false);
  const weekStartStr = useMemo(() => format(weekStart, "yyyy-MM-dd"), [weekStart]);

  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    lastSync: scheduleSync,
    hasStagedUpdate,
    applyStagedUpdate,
    refetch: refetchShifts,
  } = useCachedQuery(
    `shifts:week:${weekStartStr}`,
    (signal) => getShiftsByWeek(weekStart, locationId, signal),
    {
      locationId,
      userId: user?.id,
      isEditing: isShiftEditing,
    }
  );

  const scheduleKey = `${locationId}:${weekStartStr}`;
  const scopedSchedule = scheduleData?.locationId === locationId && scheduleData.weekStart === weekStartStr
    ? scheduleData
    : undefined;
  const [localSchedule, setLocalSchedule] = useState<{
    key: string;
    base: typeof scopedSchedule;
    shifts: Shift[];
  }>();
  const shifts = localSchedule?.key === scheduleKey && localSchedule.base === scopedSchedule
    ? localSchedule.shifts
    : scopedSchedule?.shifts ?? NO_SHIFTS;

  const [pendingShiftWrites, setPendingShiftWrites] = useState(0);
  const [rosterVersion, setRosterVersion] = useState(0);

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
    ? { addShift: "Lägg till pass", save: "Spara pass", delete: "Ta bort pass", hours: "Planerade timmar", conflicts: "Konflikter", gaps: "Bemanningsluckor", week: "Vecka", noShifts: "Inga pass planerade." }
    : { addShift: "Add shift", save: "Save shift", delete: "Delete shift", hours: "Planned hours", conflicts: "Conflicts", gaps: "Coverage gaps", week: "Week", noShifts: "No shifts planned." };

  // Attendance state
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionWithEmployee[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [scheduleView, setScheduleView] = useState<"schedule" | "attendance">("schedule");

  const loading = scheduleLoading && shifts.length === 0;

  // Fetch attendance for the selected day (re-runs when day or location changes)
  useEffect(() => {
    let active = true;
    (async () => {
      setAttendanceLoading(true);
      try {
        const params = new URLSearchParams({ from: selectedDay, to: selectedDay });
        if (locationId) params.set("locationId", locationId);
        const res = await fetch(`/api/attendance/report?${params}`);
        if (!res.ok) return;
        const { sessions } = await res.json();
        if (!active) return;
        setAttendanceSessions(sessions ?? []);
      } catch {
        // silently fail — attendance is supplementary data
      } finally {
        if (active) setAttendanceLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedDay, locationId]);

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

  const selectedDayShifts = shiftsByDay.get(selectedDay) ?? NO_SHIFTS;
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

  async function saveRosterChange(
    write: () => Promise<(current: Shift[]) => Shift[]>,
    message: string,
  ) {
    setPendingShiftWrites((count) => count + 1);
    setRosterVersion((version) => version + 1);
    try {
      const apply = await write();
      setLocalSchedule((current) => ({
        key: scheduleKey,
        base: scopedSchedule,
        shifts: apply(current?.key === scheduleKey && current.base === scopedSchedule ? current.shifts : shifts),
      }));
      toast.success(message);
      void refetchShifts();
    } finally {
      setPendingShiftWrites((count) => count - 1);
    }
  }

  function handleCreate(form: ShiftForm) {
    return saveRosterChange(async () => {
      const emp = employees.find((employee) => employee.id === form.employeeId);
      const created = await createShift({
        employeeId: form.employeeId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        role: form.role,
        locationId: emp?.locationId ?? locationId,
        status: "draft",
      });
      return (current) => [...current, created];
    }, lang === "sv" ? "Pass tillagt" : "Shift added");
  }

  function handleUpdate(shiftId: string, form: ShiftForm) {
    return saveRosterChange(async () => {
      const updated = await updateShift(shiftId, form);
      return (current) => current.map((shift) => shift.id === shiftId ? updated : shift);
    }, lang === "sv" ? "Pass uppdaterat" : "Shift updated");
  }

  function handleDelete(shiftId: string) {
    return saveRosterChange(async () => {
      await deleteShift(shiftId);
      return (current) => current.filter((shift) => shift.id !== shiftId);
    }, lang === "sv" ? "Pass borttaget" : "Shift deleted");
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
              <Link
                href={`/ai-agent?week=${toWeekParam(weekStart)}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Bot className="h-3.5 w-3.5 text-blue-600" />
                {lang === "sv" ? "AI-optimera" : "AI Optimize"}
              </Link>
            )}
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
                onOpenChangeState={setIsShiftEditing}
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
        {canEdit && (
          <AiSuggestionRow
            date={selectedDay}
            locationId={user?.role === "admin" ? user.locationId ?? "" : locationId}
            lang={lang}
            saving={pendingShiftWrites > 0}
            rosterVersion={rosterVersion}
            scheduleSync={scheduleSync}
            userId={user?.id}
          />
        )}
      </div>

      {/* ── Day panel: Schedule + Attendance tabs ── */}
      <div className="app-panel overflow-hidden">
        {hasStagedUpdate && (
          <div className="border-b border-blue-200 bg-blue-50 px-5 py-2.5 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                {lang === "sv"
                  ? "Nyare schemadata finns tillgänglig från databasen."
                  : "Fresh schedule updates are available from the database."}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-blue-300 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-100"
              onClick={() => applyStagedUpdate()}
            >
              {lang === "sv" ? "Uppdatera vy" : "Update View"}
            </Button>
          </div>
        )}
        {/* Panel header */}
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
            {/* Role legend — only shown in schedule view */}
            {scheduleView === "schedule" && (
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
            )}
          </div>

          {/* Tab switcher */}
          <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1" style={{ width: "fit-content" }}>
            <button
              type="button"
              onClick={() => setScheduleView("schedule")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${scheduleView === "schedule" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {lang === "sv" ? "Schema" : "Schedule"}
            </button>
            <button
              type="button"
              onClick={() => setScheduleView("attendance")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${scheduleView === "attendance" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {lang === "sv" ? "Närvaro" : "Attendance"}
            </button>
          </div>

          {/* Active filter chips — schedule view only */}
          {scheduleView === "schedule" && (filterEmployeeIds.size > 0 || filterRoles.size > 0) && (
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

        {/* ── Schedule view (Gantt) ── */}
        {scheduleView === "schedule" && (
          loading ? (
            <div className="py-14 text-center text-sm text-slate-400">Loading schedule…</div>
          ) : (
            <ErrorBoundary>
              <GanttScheduleCanvas
                sortedEmployees={sortedEmployees}
                selectedDayShiftsByEmployee={selectedDayShiftsByEmployee}
                canEdit={canEdit}
                selectedDay={selectedDay}
                employees={employees}
                onOpenChangeState={setIsShiftEditing}
                onCreated={handleCreate}
                onUpdated={handleUpdate}
                onDeleted={handleDelete}
                lang={lang}
              />
            </ErrorBoundary>
          )
        )}

        {/* ── Attendance view ── */}
        {scheduleView === "attendance" && (
          <AttendanceTabView
            employees={employees}
            dayShifts={selectedDayShifts}
            sessions={attendanceSessions}
            loading={attendanceLoading || loading}
            lang={lang}
          />
        )}
      </div>



    </div>
  );
}

// ─── Attendance tab view ──────────────────────────────────────────────────────

type AttendanceCardState = "complete" | "active" | "no-punch" | "unscheduled";

function getCardState(hasShift: boolean, session: AttendanceSessionWithEmployee | null): AttendanceCardState {
  if (!hasShift) return "unscheduled";
  if (!session) return "no-punch";
  if (!session.clockedOutAt) return "active";
  return "complete";
}

function formatPunchTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

const CARD_STATE_STYLE: Record<AttendanceCardState, {
  bannerBg: string; bannerBorder: string; bannerText: string; bannerLabel: string;
  punchBg: string; punchBorder: string; punchText: string; punchLabelColor: string; punchLabel: string;
}> = {
  complete: {
    bannerBg: "#f0fdf4", bannerBorder: "#bbf7d0", bannerText: "#15803d", bannerLabel: "Complete ✓",
    punchBg: "#f0fdf4", punchBorder: "#bbf7d0", punchText: "#14532d", punchLabelColor: "#15803d", punchLabel: "Clocked in / out",
  },
  active: {
    bannerBg: "#fffbeb", bannerBorder: "#fde68a", bannerText: "#b45309", bannerLabel: "Active shift",
    punchBg: "#fffbeb", punchBorder: "#fde68a", punchText: "#92400e", punchLabelColor: "#b45309", punchLabel: "Clocked in — still active",
  },
  "no-punch": {
    bannerBg: "#fef2f2", bannerBorder: "#fecaca", bannerText: "#b91c1c", bannerLabel: "Not clocked in",
    punchBg: "#fef2f2", punchBorder: "#fecaca", punchText: "#ef4444", punchLabelColor: "#b91c1c", punchLabel: "No punch recorded",
  },
  unscheduled: {
    bannerBg: "#f0f9ff", bannerBorder: "#bae6fd", bannerText: "#0369a1", bannerLabel: "Unscheduled",
    punchBg: "#f0fdf4", punchBorder: "#bbf7d0", punchText: "#14532d", punchLabelColor: "#15803d", punchLabel: "Clocked in / out",
  },
};

function AttendanceTabView({
  employees,
  dayShifts,
  sessions,
  loading,
  lang,
}: {
  employees: Employee[];
  dayShifts: Shift[];
  sessions: AttendanceSessionWithEmployee[];
  loading: boolean;
  lang: "en" | "sv";
}) {
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const sessionByEmployee = new Map(sessions.map((s) => [s.employeeId, s]));

  // One card per unique employee — earliest shift per employee
  const shiftByEmployee = new Map<string, Shift>();
  for (const shift of [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    if (!shiftByEmployee.has(shift.employeeId)) shiftByEmployee.set(shift.employeeId, shift);
  }

  type Row = { employeeId: string; name: string; role: string; shift: Shift | null; session: AttendanceSessionWithEmployee | null };
  const rows: Row[] = [];
  const seen = new Set<string>();

  // Employees with shifts (sorted by start time)
  for (const [empId, shift] of shiftByEmployee) {
    const emp = employeeMap.get(empId);
    rows.push({ employeeId: empId, name: emp?.name ?? shift.employeeName, role: emp?.role ?? shift.role, shift, session: sessionByEmployee.get(empId) ?? null });
    seen.add(empId);
  }

  // Employees with punch but no shift
  for (const s of sessions) {
    if (seen.has(s.employeeId)) continue;
    rows.push({ employeeId: s.employeeId, name: s.employeeName, role: s.employeeRole, shift: null, session: s });
  }

  if (loading) {
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-slate-400">
        {lang === "sv" ? "Ingen närvaro registrerad för detta datum." : "No attendance recorded for this day."}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => {
        const state = getCardState(row.shift !== null, row.session);
        const style = CARD_STATE_STYLE[state];

        // Scheduled time text
        const scheduledText = row.shift ? `${row.shift.startTime} – ${row.shift.endTime}` : null;

        // Punch time text
        let punchText = "—";
        if (row.session) {
          const inTime = formatPunchTime(row.session.clockedInAt);
          punchText = row.session.clockedOutAt
            ? `${inTime} – ${formatPunchTime(row.session.clockedOutAt)}`
            : `${inTime} – ${lang === "sv" ? "pågående" : "ongoing"}`;
        }

        return (
          <div key={row.employeeId} className="flex items-stretch">
            {/* Employee name column */}
            <div
              className="flex w-44 shrink-0 flex-col justify-center border-r border-slate-100 px-4 py-4"
              style={{ minWidth: 144 }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: avatarColor(row.name) }}
                >
                  {initials(row.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-900">{row.name}</div>
                  <div className="truncate text-[11px] capitalize text-slate-400">{row.role}</div>
                </div>
              </div>
            </div>

            {/* Right: two stacked boxes */}
            <div className="flex flex-1 flex-col gap-2 px-4 py-3">
              {/* State banner */}
              <div
                className="self-start rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: style.bannerBg, color: style.bannerText, border: `1px solid ${style.bannerBorder}` }}
              >
                {lang === "sv"
                  ? { complete: "Klar ✓", active: "Aktivt pass", "no-punch": "Ej instämplad", unscheduled: "Oschemalagd" }[state]
                  : style.bannerLabel}
              </div>

              <div className="flex gap-3">
                {/* Scheduled box */}
                <div
                  className="flex-1 rounded-lg px-3 py-2"
                  style={{ background: "#fafaff", border: "1px solid #e0e7ff" }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#6366f1" }}>
                    {lang === "sv" ? "Schemalagd tid" : "Scheduled"}
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold" style={{ color: scheduledText ? "#312e81" : "#cbd5e1" }}>
                    {scheduledText ?? (lang === "sv" ? "Ingen tid" : "No shift")}
                  </div>
                </div>

                {/* Punch box */}
                <div
                  className="flex-1 rounded-lg px-3 py-2"
                  style={{ background: style.punchBg, border: `1px solid ${style.punchBorder}` }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: style.punchLabelColor }}>
                    {lang === "sv"
                      ? { complete: "In / ut", active: "Incheckad — pågående", "no-punch": "Ingen stämpling", unscheduled: "In / ut" }[state]
                      : style.punchLabel}
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold" style={{ color: style.punchText }}>
                    {punchText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<DashboardSkeleton type="schedule" />}>
      <SchedulePageContent />
    </Suspense>
  );
}

"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { Employee, Shift } from "@/lib/types";
import { ShiftPopover, type ShiftForm } from "./shift-popover";

// ─── Time / Gantt helpers ──────────────────────────────────────────────────────

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

// ─── Gantt row ────────────────────────────────────────────────────────────────

function GanttRow({
  employee,
  dayShifts,
  canEdit,
  selectedDay,
  employees,
  onOpenChangeState,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  employee: Employee;
  dayShifts: Shift[];
  canEdit: boolean;
  selectedDay: string;
  employees: Employee[];
  onOpenChangeState?: (isOpen: boolean) => void;
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
      <div
        className="flex shrink-0 items-center gap-2.5 border-r border-slate-100 bg-white px-4 py-2"
        style={{ width: 220, minWidth: 220 }}
      >
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
            defaultForm={{
              employeeId: employee.id,
              date: selectedDay,
              startTime: "10:00",
              endTime: "18:00",
              role: employee.role ?? "service",
            }}
            onOpenChangeState={onOpenChangeState}
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
              defaultForm={{
                employeeId: shift.employeeId,
                date: shift.date,
                startTime: shift.startTime,
                endTime: shift.endTime,
                role: shift.role,
              }}
              onOpenChangeState={onOpenChangeState}
              onSave={(form) => onUpdated(shift.id, form)}
              onDelete={() => onDeleted(shift.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Gantt Schedule Canvas Component ──────────────────────────────────────────

export interface GanttScheduleCanvasProps {
  sortedEmployees: Employee[];
  selectedDayShiftsByEmployee: Map<string, Shift[]>;
  canEdit: boolean;
  selectedDay: string;
  employees: Employee[];
  onOpenChangeState?: (isOpen: boolean) => void;
  onCreated: (form: ShiftForm) => Promise<void>;
  onUpdated: (shiftId: string, form: ShiftForm) => Promise<void>;
  onDeleted: (shiftId: string) => Promise<void>;
  lang?: "en" | "sv";
}

export default function GanttScheduleCanvas({
  sortedEmployees,
  selectedDayShiftsByEmployee,
  canEdit,
  selectedDay,
  employees,
  onOpenChangeState,
  onCreated,
  onUpdated,
  onDeleted,
  lang = "en",
}: GanttScheduleCanvasProps): React.JSX.Element {
  const noShiftsText = lang === "sv" ? "Inga pass planerade." : "No shifts planned.";

  return (
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
          <div className="py-14 text-center text-sm text-slate-400">{noShiftsText}</div>
        ) : (
          sortedEmployees.map((emp) => (
            <GanttRow
              key={emp.id}
              employee={emp}
              dayShifts={selectedDayShiftsByEmployee.get(emp.id) ?? []}
              canEdit={canEdit}
              selectedDay={selectedDay}
              employees={employees}
              onOpenChangeState={onOpenChangeState}
              onCreated={onCreated}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}

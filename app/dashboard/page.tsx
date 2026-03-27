"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Plus, Send, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCATION_ID } from "@/lib/constants";
import { createShift, getEmployees, getShiftsByWeek, isSupabaseConfigured } from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";
import { useAIAgent } from "@/hooks/use-ai-agent";

type NewEventForm = {
  title: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
};

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEventOpen, setNewEventOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventForm, setEventForm] = useState<NewEventForm>({
    title: "",
    employeeId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "18:00",
    notes: "",
  });

  const [message, setMessage] = useState("");

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);

  const {
    result: aiResult,
    generate: generateWithAi,
    generating: aiGenerating,
    error: aiError,
    isSupabaseConfigured: aiConfigured,
  } = useAIAgent({ weekStart, autoLoad: true });

  const refreshDashboard = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setEmployees([]);
      setWeekShifts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [employeeRows, schedule] = await Promise.all([
        getEmployees(),
        getShiftsByWeek(weekStart, LOCATION_ID),
      ]);
      setEmployees(employeeRows);
      setWeekShifts(schedule.shifts);
      if (!eventForm.employeeId && employeeRows[0]?.id) {
        setEventForm((prev) => ({ ...prev, employeeId: employeeRows[0].id }));
      }
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [eventForm.employeeId, weekStart]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const todayShifts = useMemo(
    () => {
      const employeeMap = new Map(employees.map((e) => [e.id, e.name]));
      return weekShifts
        .filter((shift) => shift.date === todayKey)
        .map((shift) => ({
          ...shift,
          // Fallback to employee lookup if name is missing
          employeeName: shift.employeeName || employeeMap.get(shift.employeeId) || "—",
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    },
    [todayKey, weekShifts, employees]
  );

  const activeEmployeeCount = useMemo(() => {
    return new Set(todayShifts.map((shift) => shift.employeeId)).size;
  }, [todayShifts]);

  const weeklyHoursByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const shift of weekShifts) {
      map.set(
        shift.employeeId,
        (map.get(shift.employeeId) ?? 0) + shiftHours(shift.startTime, shift.endTime)
      );
    }
    return map;
  }, [weekShifts]);

  const conflictItems = useMemo(() => {
    const overlaps: string[] = [];
    const overLimit: string[] = [];

    const byEmployee = new Map<string, Shift[]>();
    for (const shift of weekShifts) {
      const list = byEmployee.get(shift.employeeId) ?? [];
      list.push(shift);
      byEmployee.set(shift.employeeId, list);
    }

    byEmployee.forEach((items) => {
      const ordered = items
        .slice()
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1];
        const current = ordered[i];
        if (prev.date === current.date && prev.endTime > current.startTime) {
          overlaps.push(`${current.employeeName} has overlapping shifts on ${current.date}`);
        }
      }
    });

    employees.forEach((employee) => {
      const hours = weeklyHoursByEmployee.get(employee.id) ?? 0;
      if (hours > employee.maxWeeklyHours) {
        overLimit.push(`${employee.name} exceeds weekly max (${hours.toFixed(1)}h/${employee.maxWeeklyHours}h)`);
      }
    });

    return [...overlaps, ...overLimit].slice(0, 6);
  }, [employees, weekShifts, weeklyHoursByEmployee]);

  const aiSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    const lunchCount = todayShifts.filter(
      (shift) => shift.startTime <= "11:00" && shift.endTime >= "14:00"
    ).length;
    const dinnerCount = todayShifts.filter(
      (shift) => shift.startTime <= "17:00" && shift.endTime >= "21:00"
    ).length;

    if (lunchCount < 2) {
      suggestions.push("Lunch coverage is below 2 people. Add one service shift 11:00–14:00.");
    }
    if (dinnerCount < 2) {
      suggestions.push("Dinner coverage is below 2 people. Add one evening shift 17:00–21:00.");
    }
    if (conflictItems.length > 0) {
      suggestions.push("Resolve overlap conflicts before publishing this week.");
    }
    if (suggestions.length === 0) {
      suggestions.push("Coverage looks stable. Consider balancing weekend shifts for fairness.");
    }
    return suggestions.slice(0, 3);
  }, [conflictItems.length, todayShifts]);

  async function handleNewEventSave() {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      return;
    }
    if (!eventForm.employeeId || !eventForm.date || !eventForm.startTime || !eventForm.endTime) return;
    setSavingEvent(true);
    setError(null);
    try {
      const employee = employees.find((item) => item.id === eventForm.employeeId);
      const created = await createShift({
        employeeId: eventForm.employeeId,
        date: eventForm.date,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        role: employee?.role ?? "service",
        locationId: employee?.locationId || LOCATION_ID,
        status: "draft",
        createdByAi: false,
        notes: eventForm.notes || eventForm.title || undefined,
      });
      setWeekShifts((prev) =>
        [...prev, { ...created, employeeName: employee?.name || created.employeeName }].sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
        )
      );
      setNewEventOpen(false);
      toast.success("Shift added");
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "shift_assigned",
          title: "Shift assigned",
          message: `${employee?.name || "Employee"} • ${eventForm.startTime}-${eventForm.endTime} (${eventForm.date})`,
        }),
      });
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to create event.");
      toast.error("Failed to save — try again");
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleAiSend() {
    if (!message.trim() || !aiConfigured) return;
    await generateWithAi(message);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <div className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {format(today, "MMMM d, yyyy")}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Live operations overview
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:text-slate-900"
                type="button"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:text-slate-900"
                type="button"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <Button
                className="glass-button rounded-full px-4 text-slate-900"
                variant="outline"
                onClick={() => setNewEventOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New Event
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="glass-muted rounded-2xl p-3">
              <div className="text-xs text-slate-600">Today&apos;s shifts</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{todayShifts.length}</div>
            </div>
            <div className="glass-muted rounded-2xl p-3">
              <div className="text-xs text-slate-600">Active employees</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{activeEmployeeCount}</div>
            </div>
            <div className="glass-muted rounded-2xl p-3">
              <div className="text-xs text-slate-600">Conflicts</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{conflictItems.length}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-900">
              Who&apos;s Working Today
            </div>
            <div className="mt-3 space-y-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-white/40" />
              ) : todayShifts.length ? (
                todayShifts.map((shift, idx) => (
                  <div
                    key={shift.id}
                    className="glass-muted rounded-2xl p-4"
                    style={{
                      background:
                        idx % 3 === 0
                          ? "linear-gradient(135deg, rgba(90,140,255,0.20), rgba(255,255,255,0.35))"
                          : idx % 3 === 1
                            ? "linear-gradient(135deg, rgba(70,210,200,0.17), rgba(255,255,255,0.35))"
                            : "linear-gradient(135deg, rgba(255,160,200,0.16), rgba(255,255,255,0.35))",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {shift.employeeName || "—"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-700">
                          {shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-700">
                        <div className="opacity-70">Role</div>
                        <div className="font-semibold">{shift.role}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/40 bg-white/35 p-4 text-sm text-slate-700">
                  No shifts found for today.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">
              Today&apos;s Schedule
            </div>
            <span className="glass-chip px-3 py-1 text-[11px] font-semibold text-slate-900">
              {todayShifts.length} items
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="h-44 animate-pulse rounded-2xl bg-white/40" />
            ) : todayShifts.length ? (
              todayShifts.map((shift, i) => (
                <div
                  key={shift.id}
                  className="glass-muted rounded-2xl p-4"
                  style={{
                    background:
                      i % 4 === 0
                        ? "linear-gradient(135deg, rgba(90,140,255,0.20), rgba(255,255,255,0.34))"
                        : i % 4 === 1
                          ? "linear-gradient(135deg, rgba(120,110,255,0.16), rgba(255,255,255,0.34))"
                          : i % 4 === 2
                            ? "linear-gradient(135deg, rgba(70,210,200,0.16), rgba(255,255,255,0.34))"
                            : "linear-gradient(135deg, rgba(255,170,230,0.16), rgba(255,255,255,0.34))",
                  }}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {shift.role}
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    {shift.startTime.slice(0, 5)} • {shift.endTime.slice(0, 5)} • {shift.employeeName || "—"}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/40 bg-white/35 p-4 text-sm text-slate-700">
                No events scheduled today.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-slate-900/80" />
            <div className="text-sm font-semibold text-slate-900">
              Schedule Conflicts
            </div>
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {loading ? (
              <div className="h-20 animate-pulse rounded-2xl bg-white/40" />
            ) : conflictItems.length ? (
              conflictItems.map((item) => (
                <div key={item} className="glass-muted rounded-xl border border-white/70 px-3 py-2">
                  {item}
                </div>
              ))
            ) : (
              <div className="glass-muted rounded-xl border border-white/70 px-3 py-2">
                No conflicts detected for this week.
              </div>
            )}
          </div>
        </div>

        <div className="ai-intelligence-border">
          <div className="glass-card ai-intelligence-inner relative z-10 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-900/80" />
              <div className="text-sm font-semibold text-slate-900">
                AI Optimization Suggestions
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {aiSuggestions.map((suggestion) => (
                <li key={suggestion} className="glass-muted rounded-xl border border-white/70 px-3 py-2">
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <div className="glass-chip flex h-8 w-8 items-center justify-center">
              <Sparkles className="h-4 w-4 text-slate-900/80" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                AI Assistant
              </div>
              <div className="text-xs text-slate-600">
                Same engine as AI Agent tab
              </div>
            </div>
          </div>

          <div className="mt-4 glass-muted rounded-2xl p-4 text-sm text-slate-700">
            {aiResult?.explanation || "Ask AI to optimize shifts, suggest replacements, or detect conflicts."}
          </div>

          {aiError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {aiError}
            </div>
          )}

          {aiResult?.warnings?.length ? (
            <div className="mt-3 space-y-2">
              {aiResult.warnings.slice(0, 2).map((warning) => (
                <div
                  key={warning}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <div className="glass-muted flex flex-1 items-center rounded-full px-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask AI to optimize this week..."
                className="h-11 border-0 bg-transparent px-0 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <button
              type="button"
              className="glass-button flex h-11 w-11 items-center justify-center rounded-full text-slate-900"
              onClick={() => void handleAiSend()}
              aria-label="Send"
              disabled={aiGenerating || !message.trim()}
            >
              {aiGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="glass-card p-5">
            <div className="text-sm font-semibold text-slate-900">
              Setup required
            </div>
            <div className="mt-1 text-sm text-slate-700">
              Supabase is not configured. Add{" "}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
              <span className="font-mono">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </span>{" "}
              to <span className="font-mono">.env.local</span>.
            </div>
          </div>
        )}
      </div>

      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent className="glass-shift-modal max-w-md border-none bg-transparent">
          <DialogHeader>
            <DialogTitle className="font-mono text-slate-900">New Event</DialogTitle>
            <DialogDescription className="text-slate-600">
              Create a shift event and sync it to the schedule immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-600">Event title</label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                className="border-white/80 bg-white/70"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Employee</label>
              <Select
                value={eventForm.employeeId}
                onValueChange={(value) => setEventForm((prev) => ({ ...prev, employeeId: value }))}
              >
                <SelectTrigger className="border-white/80 bg-white/70">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="border-white/80 bg-white/90">
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Date</label>
              <Input
                type="date"
                value={eventForm.date}
                onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
                className="border-white/80 bg-white/70"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">Start time</label>
                <Input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="border-white/80 bg-white/70"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">End time</label>
                <Input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="border-white/80 bg-white/70"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Notes</label>
              <Input
                value={eventForm.notes}
                onChange={(e) => setEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="border-white/80 bg-white/70"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="glass-popup-button text-slate-900"
              onClick={() => setNewEventOpen(false)}
              disabled={savingEvent}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="glass-popup-button border-white/90 bg-white/80 text-slate-900"
              onClick={() => void handleNewEventSave()}
              disabled={savingEvent || !eventForm.employeeId}
            >
              {savingEvent ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

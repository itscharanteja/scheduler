import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shift } from "./types";

export type SuggestionAssignment = Pick<Shift, "id" | "employeeId" | "date" | "startTime" | "endTime" | "role" | "status">;

export type StaffingSuggestion = {
  startTime: string;
  endTime: string;
  scheduledHeadcount: number;
  action: "add" | "reduce" | "keep" | "review";
  count?: number;
  rationale: string;
};

export type ScheduleSuggestionResult = {
  date: string;
  locationId: string;
} & (
  | { status: "empty"; rosterRevision: string }
  | { status: "ready"; rosterRevision: string; forecastTime: string; expiresAt: string; suggestions: StaffingSuggestion[] }
  | { status: "unavailable"; rosterRevision: string | null; source: "schedule" | "forecast" | "model"; retryable: boolean }
);

export const DAY_SECONDS = 24 * 60 * 60;

export function isScheduleDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function previousScheduleDate(date: string): string {
  return new Date(Date.parse(date) - DAY_SECONDS * 1000).toISOString().slice(0, 10);
}

export function clockSeconds(time: string): number {
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

export function assignmentBounds(assignment: SuggestionAssignment, date: string) {
  const offset = assignment.date === date ? 0 : -DAY_SECONDS;
  const start = clockSeconds(assignment.startTime);
  const end = clockSeconds(assignment.endTime);
  return { start: start + offset, end: end + offset + (end < start ? DAY_SECONDS : 0) };
}

export function overlappingAssignments(assignments: SuggestionAssignment[], date: string) {
  const previous = previousScheduleDate(date);
  return assignments.filter((assignment) => {
    if (assignment.date !== date && assignment.date !== previous) return false;
    const { start, end } = assignmentBounds(assignment, date);
    return Math.max(start, 0) < Math.min(end, DAY_SECONDS);
  });
}

export async function scheduleRosterRevision(assignments: SuggestionAssignment[]) {
  const rows = assignments.map(({ id, employeeId, date, startTime, endTime, role, status }) =>
    JSON.stringify([id, employeeId, date, clockSeconds(startTime), clockSeconds(endTime), role, status])
  ).sort();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(rows)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readSuggestionAssignments(
  client: SupabaseClient,
  locationId: string,
  date: string,
  signal: AbortSignal,
): Promise<SuggestionAssignment[]> {
  const assignments: SuggestionAssignment[] = [];
  const previous = previousScheduleDate(date);
  let afterId: string | undefined;

  while (true) {
    let query = client.from("shifts")
      .select("id, employee_id, date, start_time, end_time, role, status")
      .eq("location_id", locationId)
      .in("date", [previous, date])
      .in("status", ["draft", "published"]);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query.order("id").limit(500).abortSignal(signal);
    if (error) throw error;
    if (data.length === 0) return overlappingAssignments(assignments, date);

    for (const row of data) {
      assignments.push({
        id: row.id,
        employeeId: row.employee_id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        role: row.role,
        status: row.status,
      });
    }
    if (data.length < 500) return overlappingAssignments(assignments, date);
    afterId = data[data.length - 1].id;
  }
}

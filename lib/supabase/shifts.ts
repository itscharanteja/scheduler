import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";
import type { Shift, WeekSchedule } from "@/lib/types";
import { getRuntimeStore } from "@/lib/server/runtime-store";
import { supabaseClient, requireClient, normalizeSupabaseError } from "./client";

type DbShiftRow = {
  id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  location_id: string | null;
  status: string;
  created_by_ai: boolean;
  notes: string | null;
  created_at: string;
  employee_name?: string | null;
};

type DbShiftRowWithEmployee = Omit<DbShiftRow, "employee_name"> & {
  employees?: { name: string } | { name: string }[] | null;
};

function getEmployeeNameFromRelation(
  relation: DbShiftRowWithEmployee["employees"]
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.name ?? null;
  return relation.name;
}

function mapShift(row: DbShiftRow): Shift {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "",
    role: row.role,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    locationId: row.location_id ?? "",
    status: row.status as Shift["status"],
    createdByAi: row.created_by_ai,
    notes: row.notes ?? undefined,
  };
}

export async function getShiftsByWeek(
  weekStart: string | Date,
  locationId?: string
): Promise<WeekSchedule> {
  try {
    const start = startOfWeek(
      typeof weekStart === "string" ? new Date(weekStart) : weekStart,
      { weekStartsOn: 1 }
    );
    if (!supabaseClient) {
      const store = getRuntimeStore();
      const startDate = start.toISOString().slice(0, 10);
      const endDate = addDays(start, 6).toISOString().slice(0, 10);
      const shifts = store.shifts
        .filter((s) => s.date >= startDate && s.date <= endDate)
        .filter((s) => !locationId || s.locationId === locationId)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
      return { weekStart: startDate, locationId: locationId ?? "", shifts, status: "draft" };
    }
    const end = addDays(start, 6);
    let query = supabaseClient
      .from("shifts")
      .select("id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)")
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));
    if (locationId) query = query.eq("location_id", locationId);
    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;
    const mappedShifts: Shift[] = ((data ?? []) as unknown as DbShiftRowWithEmployee[]).map((row) =>
      mapShift({ ...row, employee_name: getEmployeeNameFromRelation(row.employees) })
    );
    return { weekStart: start.toISOString().slice(0, 10), locationId: locationId ?? "", shifts: mappedShifts, status: "draft" };
  } catch (error) {
    throw normalizeSupabaseError(error, "getShiftsByWeek");
  }
}

export async function getShiftsByMonth(
  monthDate: string | Date,
  locationId?: string
): Promise<Shift[]> {
  try {
    const base = typeof monthDate === "string" ? new Date(monthDate) : monthDate;
    const start = startOfMonth(base);
    const end = endOfMonth(base);
    if (!supabaseClient) {
      const store = getRuntimeStore();
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      return store.shifts
        .filter((s) => s.date >= startDate && s.date <= endDate)
        .filter((s) => !locationId || s.locationId === locationId)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    }
    let query = supabaseClient
      .from("shifts")
      .select("id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)")
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));
    if (locationId) query = query.eq("location_id", locationId);
    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as DbShiftRowWithEmployee[]).map((row) =>
      mapShift({ ...row, employee_name: getEmployeeNameFromRelation(row.employees) })
    );
  } catch (error) {
    throw normalizeSupabaseError(error, "getShiftsByMonth");
  }
}

export type CreateShiftInput = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  locationId: string;
  status?: Shift["status"];
  createdByAi?: boolean;
  notes?: string;
};

export async function createShift(input: CreateShiftInput): Promise<Shift> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    const employeeName = store.employees.find((e) => e.id === input.employeeId)?.name ?? "";
    const shift: Shift = {
      id: `mock-shift-${Date.now()}`,
      employeeId: input.employeeId,
      employeeName,
      role: input.role,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      locationId: input.locationId,
      status: input.status ?? "draft",
      createdByAi: input.createdByAi ?? false,
      notes: input.notes ?? undefined,
    };
    store.shifts = [shift, ...store.shifts];
    return shift;
  }
  const client = requireClient();
  const { data, error } = await client
    .from("shifts")
    .insert({
      employee_id: input.employeeId,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      role: input.role,
      location_id: input.locationId,
      status: input.status ?? "draft",
      created_by_ai: input.createdByAi ?? false,
      notes: input.notes ?? null,
    })
    .select("id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)")
    .single();
  if (error) throw error;
  const typedData = data as unknown as DbShiftRowWithEmployee;
  return mapShift({ ...typedData, employee_name: getEmployeeNameFromRelation(typedData.employees) });
}

export type UpdateShiftInput = Partial<Omit<CreateShiftInput, "employeeId">> & {
  employeeId?: string;
};

export async function updateShift(id: string, input: UpdateShiftInput): Promise<Shift> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    const existing = store.shifts.find((s) => s.id === id);
    if (!existing) throw new Error("Shift not found.");
    const employeeId = input.employeeId ?? existing.employeeId;
    const employeeName =
      store.employees.find((e) => e.id === employeeId)?.name ?? existing.employeeName;
    const updated: Shift = {
      ...existing,
      employeeId,
      employeeName,
      role: input.role ?? existing.role,
      date: input.date ?? existing.date,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      locationId: input.locationId ?? existing.locationId,
      status: input.status ?? existing.status,
      createdByAi: input.createdByAi ?? existing.createdByAi,
      notes: input.notes ?? existing.notes,
    };
    store.shifts = store.shifts.map((s) => (s.id === id ? updated : s));
    return updated;
  }
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (input.employeeId !== undefined) payload.employee_id = input.employeeId;
  if (input.date !== undefined) payload.date = input.date;
  if (input.startTime !== undefined) payload.start_time = input.startTime;
  if (input.endTime !== undefined) payload.end_time = input.endTime;
  if (input.role !== undefined) payload.role = input.role;
  if (input.locationId !== undefined) payload.location_id = input.locationId;
  if (input.status !== undefined) payload.status = input.status;
  if (input.createdByAi !== undefined) payload.created_by_ai = input.createdByAi;
  if (input.notes !== undefined) payload.notes = input.notes;
  const { data, error } = await client
    .from("shifts")
    .update(payload)
    .eq("id", id)
    .select("id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)")
    .single();
  if (error) throw error;
  const typedData = data as unknown as DbShiftRowWithEmployee;
  return mapShift({ ...typedData, employee_name: getEmployeeNameFromRelation(typedData.employees) });
}

export async function deleteShift(id: string): Promise<void> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    store.shifts = store.shifts.filter((s) => s.id !== id);
    return;
  }
  const client = requireClient();
  const { error } = await client.from("shifts").delete().eq("id", id);
  if (error) throw error;
}

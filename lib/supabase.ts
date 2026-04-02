import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Employee, Shift, WeekSchedule } from "./types";
import {
  addDays,
  endOfMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { getRuntimeStore } from "@/lib/server/runtime-store";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  console.warn(
    "[supabase] Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (copy from .env.example), then restart the dev server."
  );
}

export const supabaseClient: SupabaseClient | undefined =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : undefined;

/** True when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. */
export const isSupabaseConfigured = Boolean(supabaseClient);

function normalizeSupabaseError(
  error: unknown,
  operation: string
): Error {
  if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
    return new Error(
      `[supabase:${operation}] Network error: unable to reach Supabase. Check internet, VPN/firewall, and that your Supabase project is active.`
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(`[supabase:${operation}] Unknown error.`);
}

type DbEmployeeRow = {
  id: string;
  name: string;
  role: string;
  contract_hours: number;
  max_weekly_hours: number;
  employment_type: string;
  phone: string | null;
  location_id: string | null;
  hourly_rate: number | null;
  created_at: string;
};

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
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null;
  }
  return relation.name;
}

function mapEmployee(row: DbEmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    contractHours: row.contract_hours,
    maxWeeklyHours: row.max_weekly_hours,
    employmentType: row.employment_type as Employee["employmentType"],
    phone: row.phone ?? "",
    locationId: row.location_id ?? "",
    createdAt: row.created_at,
    hourlyRate: row.hourly_rate ?? undefined,
  };
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

// Helper to ensure we have a client when called from environments where
// NEXT_PUBLIC_SUPABASE_URL / ANON_KEY might be missing.
function requireClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabaseClient;
}

// Public API

export async function getEmployees(): Promise<Employee[]> {
  try {
    if (!supabaseClient) {
      return getRuntimeStore().employees.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    const { data, error } = await supabaseClient
      .from("employees")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data as DbEmployeeRow[]).map(mapEmployee);
  } catch (error) {
    throw normalizeSupabaseError(error, "getEmployees");
  }
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
        .filter((shift) => shift.date >= startDate && shift.date <= endDate)
        .filter((shift) => !locationId || shift.locationId === locationId)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
      return {
        weekStart: startDate,
        locationId: locationId ?? "",
        shifts,
        status: "draft",
      };
    }
    const end = addDays(start, 6);

    let query = supabaseClient
      .from("shifts")
      .select(
        "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)"
      )
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;

    const mappedShifts: Shift[] = ((data ?? []) as unknown as DbShiftRowWithEmployee[]).map((row) =>
      mapShift({
        ...row,
        employee_name: getEmployeeNameFromRelation(row.employees),
      })
    );

    return {
      weekStart: start.toISOString().slice(0, 10),
      locationId: locationId ?? "",
      shifts: mappedShifts,
      status: "draft",
    };
  } catch (error) {
    throw normalizeSupabaseError(error, "getShiftsByWeek");
  }
}

export async function getShiftsByMonth(
  monthDate: string | Date,
  locationId?: string
): Promise<Shift[]> {
  try {
    const base =
      typeof monthDate === "string" ? new Date(monthDate) : monthDate;
    const start = startOfMonth(base);
    const end = endOfMonth(base);

    if (!supabaseClient) {
      const store = getRuntimeStore();
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      return store.shifts
        .filter((shift) => shift.date >= startDate && shift.date <= endDate)
        .filter((shift) => !locationId || shift.locationId === locationId)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    }

    let query = supabaseClient
      .from("shifts")
      .select(
        "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)"
      )
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;

    return ((data ?? []) as unknown as DbShiftRowWithEmployee[]).map((row) =>
      mapShift({
        ...row,
        employee_name: getEmployeeNameFromRelation(row.employees),
      })
    );
  } catch (error) {
    throw normalizeSupabaseError(error, "getShiftsByMonth");
  }
}

// Mutations: Shifts

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
    const employeeName =
      store.employees.find((employee) => employee.id === input.employeeId)?.name ?? "";
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
    .select(
      "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)"
    )
    .single();

  if (error) throw error;

  const typedData = data as unknown as DbShiftRowWithEmployee;
  return mapShift({
    ...typedData,
    employee_name: getEmployeeNameFromRelation(typedData.employees),
  });
}

export type UpdateShiftInput = Partial<Omit<CreateShiftInput, "employeeId">> & {
  employeeId?: string;
};

export async function updateShift(
  id: string,
  input: UpdateShiftInput
): Promise<Shift> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    const existing = store.shifts.find((shift) => shift.id === id);
    if (!existing) {
      throw new Error("Shift not found.");
    }
    const employeeId = input.employeeId ?? existing.employeeId;
    const employeeName =
      store.employees.find((employee) => employee.id === employeeId)?.name ??
      existing.employeeName;
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
    store.shifts = store.shifts.map((shift) => (shift.id === id ? updated : shift));
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
    .select(
      "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)"
    )
    .single();

  if (error) throw error;

  const typedData = data as unknown as DbShiftRowWithEmployee;
  return mapShift({
    ...typedData,
    employee_name: getEmployeeNameFromRelation(typedData.employees),
  });
}

export async function deleteShift(id: string): Promise<void> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    store.shifts = store.shifts.filter((shift) => shift.id !== id);
    return;
  }
  const client = requireClient();
  const { error } = await client.from("shifts").delete().eq("id", id);
  if (error) throw error;
}

// Mutations: Employees

export type CreateEmployeeInput = {
  name: string;
  role: string;
  contractHours: number;
  maxWeeklyHours: number;
  employmentType: Employee["employmentType"];
  phone?: string;
  locationId?: string;
  hourlyRate?: number;
};

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<Employee> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    const employee: Employee = {
      id: `mock-employee-${Date.now()}`,
      name: input.name,
      role: input.role,
      contractHours: input.contractHours,
      maxWeeklyHours: input.maxWeeklyHours,
      employmentType: input.employmentType,
      phone: input.phone ?? "",
      locationId: input.locationId ?? "",
      createdAt: new Date().toISOString(),
      hourlyRate: input.hourlyRate,
    };
    store.employees = [employee, ...store.employees];
    return employee;
  }
  const client = requireClient();
  const { data, error } = await client
    .from("employees")
    .insert({
      name: input.name,
      role: input.role,
      contract_hours: input.contractHours,
      max_weekly_hours: input.maxWeeklyHours,
      employment_type: input.employmentType,
      phone: input.phone ?? null,
      location_id: input.locationId ?? null,
      hourly_rate:
        typeof input.hourlyRate === "number" ? input.hourlyRate : null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapEmployee(data as DbEmployeeRow);
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput
): Promise<Employee> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    const existing = store.employees.find((employee) => employee.id === id);
    if (!existing) {
      throw new Error("Employee not found.");
    }
    const updated: Employee = {
      ...existing,
      name: input.name ?? existing.name,
      role: input.role ?? existing.role,
      contractHours: input.contractHours ?? existing.contractHours,
      maxWeeklyHours: input.maxWeeklyHours ?? existing.maxWeeklyHours,
      employmentType: input.employmentType ?? existing.employmentType,
      phone: input.phone ?? existing.phone,
      locationId: input.locationId ?? existing.locationId,
      hourlyRate: input.hourlyRate ?? existing.hourlyRate,
    };
    store.employees = store.employees.map((employee) =>
      employee.id === id ? updated : employee
    );
    return updated;
  }
  const client = requireClient();
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.role !== undefined) payload.role = input.role;
  if (input.contractHours !== undefined)
    payload.contract_hours = input.contractHours;
  if (input.maxWeeklyHours !== undefined)
    payload.max_weekly_hours = input.maxWeeklyHours;
  if (input.employmentType !== undefined)
    payload.employment_type = input.employmentType;
  if (input.phone !== undefined) payload.phone = input.phone ?? null;
  if (input.locationId !== undefined)
    payload.location_id = input.locationId ?? null;
  if (input.hourlyRate !== undefined)
    payload.hourly_rate =
      typeof input.hourlyRate === "number" ? input.hourlyRate : null;

  const { data, error } = await client
    .from("employees")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapEmployee(data as DbEmployeeRow);
}

export async function deleteEmployee(id: string): Promise<void> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    store.employees = store.employees.filter((employee) => employee.id !== id);
    store.shifts = store.shifts.filter((shift) => shift.employeeId !== id);
    return;
  }
  const client = requireClient();
  const { error } = await client.from("employees").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────
// Weather Module
// ─────────────────────────────────────────────────

export async function getCachedWeather(
  locationId: string,
): Promise<any[] | null> {
  try {
    if (!supabaseClient) return null;

    const { data, error } = await supabaseClient
      .from("weather_forecasts")
      .select("*")
      .eq("location_id", locationId)
      .order("forecast_date", { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[supabase:getCachedWeather]", error);
    return null;
  }
}

export async function upsertWeatherForecast(
  locationId: string,
  forecasts: any[],
): Promise<void> {
  try {
    const client = requireClient();

    // Prepare data for upsert
    const data = forecasts.map((forecast) => ({
      location_id: locationId,
      forecast_date: forecast.forecastDate,
      day: forecast.day,
      temperature_high: forecast.temperatureHigh,
      temperature_low: forecast.temperatureLow,
      condition: forecast.condition,
      rain_probability: forecast.rainProbability,
      wind_speed: forecast.windSpeed,
      uv_index: forecast.uvIndex,
      staffing_suggestion: forecast.staffingSuggestion,
      inventory_suggestion: forecast.inventorySuggestion,
      fetched_at: new Date().toISOString(),
    }));

    const { error } = await client
      .from("weather_forecasts")
      .upsert(data, { onConflict: "location_id,forecast_date" });

    if (error) throw error;
  } catch (error) {
    console.error("[supabase:upsertWeatherForecast]", error);
    throw error;
  }
}

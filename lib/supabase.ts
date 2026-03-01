import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Employee, Shift, WeekSchedule } from "./types";
import { addDays, startOfWeek } from "date-fns";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  // eslint-disable-next-line no-console
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
    if (!supabaseClient) return [];
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
      return {
        weekStart: start.toISOString().slice(0, 10),
        locationId: locationId ?? "",
        shifts: [],
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

    const mappedShifts: Shift[] = (data as any[]).map((row) =>
      mapShift({
        ...(row as any),
        employee_name: row.employees?.name ?? null,
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

  return mapShift({
    ...(data as any),
    employee_name: (data as any).employees?.name ?? null,
  });
}

export type UpdateShiftInput = Partial<Omit<CreateShiftInput, "employeeId">> & {
  employeeId?: string;
};

export async function updateShift(
  id: string,
  input: UpdateShiftInput
): Promise<Shift> {
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

  return mapShift({
    ...(data as any),
    employee_name: (data as any).employees?.name ?? null,
  });
}

export async function deleteShift(id: string): Promise<void> {
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
  const client = requireClient();
  const { error } = await client.from("employees").delete().eq("id", id);
  if (error) throw error;
}

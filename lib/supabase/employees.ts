import type { Employee } from "@/lib/types";
import { getRuntimeStore } from "@/lib/server/runtime-store";
import { supabaseClient, requireClient, normalizeSupabaseError } from "./client";

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

export async function getEmployees(locationId?: string): Promise<Employee[]> {
  try {
    if (!supabaseClient) {
      const all = getRuntimeStore().employees.slice().sort((a, b) => a.name.localeCompare(b.name));
      return locationId ? all.filter((e) => e.locationId === locationId) : all;
    }
    let query = supabaseClient.from("employees").select("*").order("name", { ascending: true });
    if (locationId) query = query.eq("location_id", locationId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as DbEmployeeRow[]).map(mapEmployee);
  } catch (error) {
    throw normalizeSupabaseError(error, "getEmployees");
  }
}

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

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
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
      hourly_rate: typeof input.hourlyRate === "number" ? input.hourlyRate : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapEmployee(data as DbEmployeeRow);
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  if (!supabaseClient) {
    const store = getRuntimeStore();
    const existing = store.employees.find((e) => e.id === id);
    if (!existing) throw new Error("Employee not found.");
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
    store.employees = store.employees.map((e) => (e.id === id ? updated : e));
    return updated;
  }
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.role !== undefined) payload.role = input.role;
  if (input.contractHours !== undefined) payload.contract_hours = input.contractHours;
  if (input.maxWeeklyHours !== undefined) payload.max_weekly_hours = input.maxWeeklyHours;
  if (input.employmentType !== undefined) payload.employment_type = input.employmentType;
  if (input.phone !== undefined) payload.phone = input.phone ?? null;
  if (input.locationId !== undefined) payload.location_id = input.locationId ?? null;
  if (input.hourlyRate !== undefined)
    payload.hourly_rate = typeof input.hourlyRate === "number" ? input.hourlyRate : null;

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
    store.employees = store.employees.filter((e) => e.id !== id);
    store.shifts = store.shifts.filter((s) => s.employeeId !== id);
    return;
  }
  const client = requireClient();
  const { error } = await client.from("employees").delete().eq("id", id);
  if (error) throw error;
}

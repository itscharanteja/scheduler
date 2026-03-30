import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Employee,
  Shift,
  WeekSchedule,
  Sale,
  SalesSummary,
  WeeklySalesSummary,
  InventoryItem,
  InventoryStatus,
  InventoryUpdatePayload,
  ShiftLog,
  CreateShiftLogPayload,
  ChatChannel,
  ChatMessage,
  SendMessagePayload,
  WeatherForecast,
  DashboardSummary,
} from "./types";
import {
  addDays,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  console.warn(
    "[supabase] Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (copy from .env.example), then restart the dev server.",
  );
}

export const supabaseClient: SupabaseClient | undefined =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : undefined;

/** True when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. */
export const isSupabaseConfigured = Boolean(supabaseClient);

function normalizeSupabaseError(error: unknown, operation: string): Error {
  if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
    return new Error(
      `[supabase:${operation}] Network error: unable to reach Supabase. Check internet, VPN/firewall, and that your Supabase project is active.`,
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
  position?: string | null;
  contract_percent?: number | null;
  monthly_hours?: number | null;
  monthly_salary?: number | null;
  labour_cost_per_hour?: number | null;
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
  employees?: { name: string }[] | null;
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
    position: (row.position as Employee["position"]) ?? undefined,
    contractPercent: row.contract_percent ?? undefined,
    monthlyHours: row.monthly_hours ?? undefined,
    monthlySalary: row.monthly_salary ?? undefined,
    labourCostPerHour: row.labour_cost_per_hour ?? undefined,
    bio: undefined,
    avatarUrl: undefined,
    joinedDate: undefined,
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
      "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
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
  locationId?: string,
): Promise<WeekSchedule> {
  try {
    const start = startOfWeek(
      typeof weekStart === "string" ? new Date(weekStart) : weekStart,
      { weekStartsOn: 1 },
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
        "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)",
      )
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;

    const mappedShifts: Shift[] = (data as DbShiftRowWithEmployee[]).map(
      (row) =>
        mapShift({
          ...row,
          employee_name: row.employees?.[0]?.name ?? null,
        }),
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
  locationId?: string,
): Promise<Shift[]> {
  try {
    const base =
      typeof monthDate === "string" ? new Date(monthDate) : monthDate;
    const start = startOfMonth(base);
    const end = endOfMonth(base);

    if (!supabaseClient) return [];

    let query = supabaseClient
      .from("shifts")
      .select(
        "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)",
      )
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;

    return (data as DbShiftRowWithEmployee[]).map((row) =>
      mapShift({
        ...row,
        employee_name: row.employees?.[0]?.name ?? null,
      }),
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
      "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)",
    )
    .single();

  if (error) throw error;

  const typedData = data as DbShiftRowWithEmployee;
  return mapShift({
    ...typedData,
    employee_name: typedData.employees?.[0]?.name ?? null,
  });
}

export type UpdateShiftInput = Partial<Omit<CreateShiftInput, "employeeId">> & {
  employeeId?: string;
};

export async function updateShift(
  id: string,
  input: UpdateShiftInput,
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
  if (input.createdByAi !== undefined)
    payload.created_by_ai = input.createdByAi;
  if (input.notes !== undefined) payload.notes = input.notes;

  const { data, error } = await client
    .from("shifts")
    .update(payload)
    .eq("id", id)
    .select(
      "id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)",
    )
    .single();

  if (error) throw error;

  const typedData = data as DbShiftRowWithEmployee;
  return mapShift({
    ...typedData,
    employee_name: typedData.employees?.[0]?.name ?? null,
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
  input: CreateEmployeeInput,
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
  input: UpdateEmployeeInput,
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

// ─────────────────────────────────────────────────
// Sales Module
// ─────────────────────────────────────────────────

type DbSaleRow = {
  id: string;
  location_id: string;
  date: string;
  hour: number;
  revenue_sek: number;
  order_count: number;
  created_at: string;
};

function mapSale(row: DbSaleRow): Sale {
  return {
    id: row.id,
    locationId: row.location_id,
    date: row.date,
    hour: row.hour,
    revenueSek: row.revenue_sek,
    orderCount: row.order_count,
    createdAt: row.created_at,
  };
}

export async function getSalesByWeek(
  weekStart: string,
  locationId: string,
): Promise<WeeklySalesSummary> {
  try {
    if (!supabaseClient) {
      return {
        weekStart,
        totalRevenue: 0,
        totalOrders: 0,
        dailyBreakdown: [],
        bestDay: "",
        bestDayRevenue: 0,
      };
    }

    const start = new Date(weekStart);
    const end = addDays(start, 6);
    const prevWeekStart = subDays(start, 7);
    const prevWeekEnd = subDays(end, 7);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const prevStartStr = prevWeekStart.toISOString().slice(0, 10);
    const prevEndStr = prevWeekEnd.toISOString().slice(0, 10);

    const [{ data: currentWeek }, { data: prevWeek }] = await Promise.all([
      supabaseClient
        .from("sales")
        .select("*")
        .eq("location_id", locationId)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: true })
        .order("hour", { ascending: true }),
      supabaseClient
        .from("sales")
        .select("*")
        .eq("location_id", locationId)
        .gte("date", prevStartStr)
        .lte("date", prevEndStr)
        .order("date", { ascending: true })
        .order("hour", { ascending: true }),
    ]);

    const currentWeekData = (currentWeek as DbSaleRow[]) || [];
    const prevWeekData = (prevWeek as DbSaleRow[]) || [];

    // Group by date
    const currentByDate = new Map<
      string,
      { revenue: number; orders: number }
    >();
    const prevByDate = new Map<string, { revenue: number; orders: number }>();

    currentWeekData.forEach((row) => {
      const key = row.date;
      const existing = currentByDate.get(key) || {
        revenue: 0,
        orders: 0,
      };
      existing.revenue += row.revenue_sek;
      existing.orders += row.order_count;
      currentByDate.set(key, existing);
    });

    prevWeekData.forEach((row) => {
      const key = row.date;
      const existing = prevByDate.get(key) || { revenue: 0, orders: 0 };
      existing.revenue += row.revenue_sek;
      existing.orders += row.order_count;
      prevByDate.set(key, existing);
    });

    let totalRevenue = 0;
    let totalOrders = 0;
    let bestDay = "";
    let bestDayRevenue = 0;

    const dailyBreakdown = Array.from(currentByDate.entries()).map(
      ([date, current]) => {
        const prev = prevByDate.get(date);
        const vsLastWeek =
          prev && prev.revenue > 0
            ? Math.round(
                (((current.revenue - prev.revenue) / prev.revenue) * 100 +
                  Number.EPSILON) *
                  10,
              ) / 10
            : 0;

        totalRevenue += current.revenue;
        totalOrders += current.orders;

        if (current.revenue > bestDayRevenue) {
          bestDayRevenue = current.revenue;
          bestDay = date;
        }

        return {
          date,
          day: new Date(date).toLocaleDateString("en-SE", {
            weekday: "long",
          }),
          revenue: current.revenue,
          orders: current.orders,
          vsLastWeek,
        };
      },
    );

    return {
      weekStart: startStr,
      totalRevenue,
      totalOrders,
      dailyBreakdown,
      bestDay,
      bestDayRevenue,
    };
  } catch (error) {
    console.error("[supabase:getSalesByWeek]", error);
    return {
      weekStart,
      totalRevenue: 0,
      totalOrders: 0,
      dailyBreakdown: [],
      bestDay: "",
      bestDayRevenue: 0,
    };
  }
}

export async function getSalesByDay(
  date: string,
  locationId: string,
): Promise<SalesSummary> {
  try {
    if (!supabaseClient) {
      return {
        date,
        totalRevenue: 0,
        totalOrders: 0,
        peakHour: 0,
        peakRevenue: 0,
        hourlyBreakdown: [],
      };
    }

    const { data, error } = await supabaseClient
      .from("sales")
      .select("*")
      .eq("location_id", locationId)
      .eq("date", date)
      .order("hour", { ascending: true });

    if (error) throw error;

    const rows = (data as DbSaleRow[]) || [];

    let totalRevenue = 0;
    let totalOrders = 0;
    let peakHour = 0;
    let peakRevenue = 0;

    const hourlyBreakdown = rows.map((row) => {
      totalRevenue += row.revenue_sek;
      totalOrders += row.order_count;

      if (row.revenue_sek > peakRevenue) {
        peakRevenue = row.revenue_sek;
        peakHour = row.hour;
      }

      return {
        hour: row.hour,
        revenue: row.revenue_sek,
        orders: row.order_count,
      };
    });

    return {
      date,
      totalRevenue,
      totalOrders,
      peakHour,
      peakRevenue,
      hourlyBreakdown,
    };
  } catch (error) {
    console.error("[supabase:getSalesByDay]", error);
    return {
      date,
      totalRevenue: 0,
      totalOrders: 0,
      peakHour: 0,
      peakRevenue: 0,
      hourlyBreakdown: [],
    };
  }
}

export async function getSalesLast4Weeks(
  locationId: string,
): Promise<{ date: string; revenue: number; day: string }[]> {
  try {
    if (!supabaseClient) return [];

    const startDate = subDays(new Date(), 28).toISOString().slice(0, 10);

    const { data, error } = await supabaseClient
      .from("sales")
      .select("date, revenue_sek")
      .eq("location_id", locationId)
      .gte("date", startDate)
      .order("date", { ascending: true });

    if (error) throw error;

    const rows = (data as { date: string; revenue_sek: number }[]) || [];

    // Group by date
    const byDate = new Map<string, number>();
    rows.forEach((row) => {
      const existing = byDate.get(row.date) || 0;
      byDate.set(row.date, existing + row.revenue_sek);
    });

    return Array.from(byDate.entries()).map(([date, revenue]) => ({
      date,
      revenue,
      day: new Date(date).toLocaleDateString("en-SE", { weekday: "long" }),
    }));
  } catch (error) {
    console.error("[supabase:getSalesLast4Weeks]", error);
    return [];
  }
}

export async function getSalesHourlyAverage(
  locationId: string,
): Promise<{ hour: number; avgRevenue: number }[]> {
  try {
    if (!supabaseClient) return [];

    const startDate = subDays(new Date(), 28).toISOString().slice(0, 10);

    // Fetch all hourly sales for past 28 days
    const { data, error } = await supabaseClient
      .from("sales")
      .select("hour, revenue_sek")
      .eq("location_id", locationId)
      .gte("date", startDate)
      .order("hour", { ascending: true });

    if (error) throw error;

    const rows = (data as { hour: number; revenue_sek: number }[]) || [];

    // Group by hour and calculate average
    const byHour = new Map<number, { sum: number; count: number }>();
    rows.forEach((row) => {
      const existing = byHour.get(row.hour) || { sum: 0, count: 0 };
      existing.sum += row.revenue_sek;
      existing.count += 1;
      byHour.set(row.hour, existing);
    });

    return Array.from(byHour.entries()).map(([hour, stats]) => ({
      hour,
      avgRevenue: Math.round((stats.sum / stats.count) * 100) / 100,
    }));
  } catch (error) {
    console.error("[supabase:getSalesHourlyAverage]", error);
    return [];
  }
}

// ─────────────────────────────────────────────────
// Inventory Module
// ─────────────────────────────────────────────────

type DbInventoryRow = {
  id: string;
  location_id: string;
  item_name: string;
  category: string;
  current_stock: number;
  unit: string;
  low_threshold: number;
  critical_threshold: number;
  last_updated: string;
  updated_by?: string | null;
};

function mapInventoryItem(row: DbInventoryRow): InventoryItem {
  let status: InventoryStatus = "ok";
  if (row.current_stock <= row.critical_threshold) {
    status = "critical";
  } else if (row.current_stock <= row.low_threshold) {
    status = "low";
  }

  return {
    id: row.id,
    locationId: row.location_id,
    itemName: row.item_name,
    category: row.category as any,
    currentStock: row.current_stock,
    unit: row.unit,
    lowThreshold: row.low_threshold,
    criticalThreshold: row.critical_threshold,
    lastUpdated: row.last_updated,
    updatedBy: row.updated_by ?? undefined,
    status,
  };
}

export async function getInventory(
  locationId: string,
): Promise<InventoryItem[]> {
  try {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("inventory")
      .select("*")
      .eq("location_id", locationId)
      .order("item_name", { ascending: true });

    if (error) throw error;

    const items = ((data as DbInventoryRow[]) || [])
      .map(mapInventoryItem)
      .sort((a, b) => {
        const statusOrder = { critical: 0, low: 1, ok: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

    return items;
  } catch (error) {
    console.error("[supabase:getInventory]", error);
    return [];
  }
}

export async function getLowStockItems(
  locationId: string,
): Promise<InventoryItem[]> {
  try {
    const items = await getInventory(locationId);
    return items.filter((item) => item.status !== "ok");
  } catch (error) {
    console.error("[supabase:getLowStockItems]", error);
    return [];
  }
}

export async function updateInventoryItem(
  payload: InventoryUpdatePayload,
): Promise<InventoryItem | null> {
  try {
    const client = requireClient();

    const { data, error } = await client
      .from("inventory")
      .update({
        current_stock: payload.newStock,
        last_updated: new Date().toISOString(),
        updated_by: payload.updatedBy,
      })
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return mapInventoryItem(data as DbInventoryRow);
  } catch (error) {
    console.error("[supabase:updateInventoryItem]", error);
    return null;
  }
}

// ─────────────────────────────────────────────────
// Shift Log Module
// ─────────────────────────────────────────────────

type DbShiftLogRow = {
  id: string;
  location_id: string;
  shift_leader_id: string;
  date: string;
  shift_type: string;
  notes: string;
  issues_flagged: boolean;
  tasks_completed: string;
  tasks_pending: string;
  created_at: string;
};

function mapShiftLog(row: DbShiftLogRow, shiftLeaderName?: string): ShiftLog {
  return {
    id: row.id,
    locationId: row.location_id,
    shiftLeaderId: row.shift_leader_id,
    shiftLeaderName,
    date: row.date,
    shiftType: row.shift_type as any,
    notes: row.notes,
    issuesFlagged: row.issues_flagged,
    tasksCompleted: JSON.parse(row.tasks_completed || "[]"),
    tasksPending: JSON.parse(row.tasks_pending || "[]"),
    createdAt: row.created_at,
  };
}

export async function getShiftLogs(
  locationId: string,
  limit: number = 20,
): Promise<ShiftLog[]> {
  try {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("shift_logs")
      .select("*")
      .eq("location_id", locationId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data as DbShiftLogRow[]) || [];

    // Fetch employee names for each shift leader
    const shiftLeaderIds = [...new Set(rows.map((r) => r.shift_leader_id))];
    const { data: employees } = await supabaseClient
      .from("employees")
      .select("id, name")
      .in("id", shiftLeaderIds);

    const employeeMap = new Map(
      ((employees as { id: string; name: string }[]) || []).map((e) => [
        e.id,
        e.name,
      ]),
    );

    return rows.map((row) =>
      mapShiftLog(row, employeeMap.get(row.shift_leader_id)),
    );
  } catch (error) {
    console.error("[supabase:getShiftLogs]", error);
    return [];
  }
}

export async function getShiftLogsByDate(
  date: string,
  locationId: string,
): Promise<ShiftLog[]> {
  try {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("shift_logs")
      .select("*")
      .eq("location_id", locationId)
      .eq("date", date)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data as DbShiftLogRow[]) || [];

    // Fetch employee names
    const shiftLeaderIds = [...new Set(rows.map((r) => r.shift_leader_id))];
    const { data: employees } = await supabaseClient
      .from("employees")
      .select("id, name")
      .in("id", shiftLeaderIds);

    const employeeMap = new Map(
      ((employees as { id: string; name: string }[]) || []).map((e) => [
        e.id,
        e.name,
      ]),
    );

    return rows.map((row) =>
      mapShiftLog(row, employeeMap.get(row.shift_leader_id)),
    );
  } catch (error) {
    console.error("[supabase:getShiftLogsByDate]", error);
    return [];
  }
}

export async function getFlaggedLogs(
  locationId: string,
  limit: number = 10,
): Promise<ShiftLog[]> {
  try {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("shift_logs")
      .select("*")
      .eq("location_id", locationId)
      .eq("issues_flagged", true)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data as DbShiftLogRow[]) || [];

    // Fetch employee names
    const shiftLeaderIds = [...new Set(rows.map((r) => r.shift_leader_id))];
    const { data: employees } = await supabaseClient
      .from("employees")
      .select("id, name")
      .in("id", shiftLeaderIds);

    const employeeMap = new Map(
      ((employees as { id: string; name: string }[]) || []).map((e) => [
        e.id,
        e.name,
      ]),
    );

    return rows.map((row) =>
      mapShiftLog(row, employeeMap.get(row.shift_leader_id)),
    );
  } catch (error) {
    console.error("[supabase:getFlaggedLogs]", error);
    return [];
  }
}

export async function createShiftLog(
  payload: CreateShiftLogPayload,
): Promise<ShiftLog | null> {
  try {
    const client = requireClient();

    const { data, error } = await client
      .from("shift_logs")
      .insert({
        location_id: payload.locationId,
        shift_leader_id: payload.shiftLeaderId,
        date: payload.date,
        shift_type: payload.shiftType,
        notes: payload.notes,
        issues_flagged: payload.issuesFlagged,
        tasks_completed: JSON.stringify(payload.tasksCompleted),
        tasks_pending: JSON.stringify(payload.tasksPending),
      })
      .select("*")
      .single();

    if (error) throw error;

    const row = data as DbShiftLogRow;

    // Fetch shift leader name
    const { data: employee } = await client
      .from("employees")
      .select("name")
      .eq("id", payload.shiftLeaderId)
      .single();

    return mapShiftLog(row, (employee as { name: string })?.name);
  } catch (error) {
    console.error("[supabase:createShiftLog]", error);
    return null;
  }
}

// ─────────────────────────────────────────────────
// Chat Module
// ─────────────────────────────────────────────────

type DbChatChannelRow = {
  id: string;
  location_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_announcement: boolean;
  created_at: string;
};

type DbChatMessageRow = {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  is_pinned: boolean;
  created_at: string;
};

function mapChatChannel(
  row: DbChatChannelRow,
  lastMessage?: string,
  lastMessageAt?: string,
): ChatChannel {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    isAnnouncement: row.is_announcement,
    unreadCount: 0,
    lastMessage,
    lastMessageAt,
    createdAt: row.created_at,
  };
}

function mapChatMessage(
  row: DbChatMessageRow,
  senderName?: string,
  senderPosition?: string,
): ChatMessage {
  return {
    id: row.id,
    channelId: row.channel_id,
    senderId: row.sender_id,
    senderName,
    senderPosition,
    message: row.message,
    isPinned: row.is_pinned,
    createdAt: row.created_at,
  };
}

export async function getChannels(
  locationId: string,
): Promise<ChatChannel[]> {
  try {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("chat_channels")
      .select("*")
      .eq("location_id", locationId)
      .order("is_announcement", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    const channels = (data as DbChatChannelRow[]) || [];

    // Fetch last message for each channel
    const channelsWithMessages = await Promise.all(
      channels.map(async (channel) => {
        const { data: messages } = await supabaseClient
          .from("chat_messages")
          .select("message, created_at")
          .eq("channel_id", channel.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const lastMsg = messages as
          | { message: string; created_at: string }
          | undefined;

        return mapChatChannel(
          channel,
          lastMsg?.message,
          lastMsg?.created_at,
        );
      }),
    );

    return channelsWithMessages;
  } catch (error) {
    console.error("[supabase:getChannels]", error);
    return [];
  }
}

export async function getMessages(
  channelId: string,
  limit: number = 50,
): Promise<ChatMessage[]> {
  try {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("chat_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const rows = (data as DbChatMessageRow[]) || [];

    // Fetch sender details
    const senderIds = [...new Set(rows.map((r) => r.sender_id))];
    const { data: employees } = await supabaseClient
      .from("employees")
      .select("id, name, position")
      .in("id", senderIds);

    const employeeMap = new Map(
      ((employees as { id: string; name: string; position: string }[]) || []).map(
        (e) => [e.id, { name: e.name, position: e.position }],
      ),
    );

    return rows.map((row) => {
      const sender = employeeMap.get(row.sender_id);
      return mapChatMessage(row, sender?.name, sender?.position);
    });
  } catch (error) {
    console.error("[supabase:getMessages]", error);
    return [];
  }
}

export async function sendMessage(
  payload: SendMessagePayload,
): Promise<ChatMessage | null> {
  try {
    const client = requireClient();

    const { data, error } = await client
      .from("chat_messages")
      .insert({
        channel_id: payload.channelId,
        sender_id: payload.senderId,
        message: payload.message,
        is_pinned: false,
      })
      .select("*")
      .single();

    if (error) throw error;

    const row = data as DbChatMessageRow;

    // Fetch sender details
    const { data: employee } = await client
      .from("employees")
      .select("name, position")
      .eq("id", payload.senderId)
      .single();

    const emp = employee as { name: string; position: string } | undefined;

    return mapChatMessage(row, emp?.name, emp?.position);
  } catch (error) {
    console.error("[supabase:sendMessage]", error);
    return null;
  }
}

export function subscribeToMessages(
  channelId: string,
  callback: (message: ChatMessage) => void,
) {
  if (!supabaseClient) {
    throw new Error(
      "Supabase client is not configured. Cannot subscribe to messages.",
    );
  }

  return supabaseClient
    .channel(`messages:${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `channel_id=eq.${channelId}`,
      },
      async (payload) => {
        try {
          const row = payload.new as DbChatMessageRow;

          // Fetch sender details
          const { data: employee } = await supabaseClient
            .from("employees")
            .select("name, position")
            .eq("id", row.sender_id)
            .single();

          const emp = employee as
            | { name: string; position: string }
            | undefined;

          const message = mapChatMessage(row, emp?.name, emp?.position);
          callback(message);
        } catch (error) {
          console.error("[supabase:subscribeToMessages:callback]", error);
        }
      },
    )
    .subscribe();
}

// ─────────────────────────────────────────────────
// Weather Module
// ─────────────────────────────────────────────────

type DbWeatherForecastRow = {
  id: string;
  location_id: string;
  forecast_date: string;
  temperature_high: number;
  temperature_low: number;
  condition: string;
  rain_probability: number;
  wind_speed: number;
  uv_index: number;
  staffing_suggestion: string;
  inventory_suggestion: string;
  fetched_at: string;
};

function mapWeatherForecast(row: DbWeatherForecastRow): WeatherForecast {
  return {
    id: row.id,
    locationId: row.location_id,
    forecastDate: row.forecast_date,
    day: new Date(row.forecast_date).toLocaleDateString("en-SE", {
      weekday: "long",
    }),
    temperatureHigh: row.temperature_high,
    temperatureLow: row.temperature_low,
    condition: row.condition as any,
    rainProbability: row.rain_probability,
    windSpeed: row.wind_speed,
    uvIndex: row.uv_index,
    staffingSuggestion: row.staffing_suggestion,
    inventorySuggestion: row.inventory_suggestion,
    fetchedAt: row.fetched_at,
  };
}

export async function getCachedWeather(
  locationId: string,
): Promise<WeatherForecast[]> {
  try {
    if (!supabaseClient) return [];

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabaseClient
      .from("weather_cache")
      .select("*")
      .eq("location_id", locationId)
      .gte("forecast_date", today)
      .order("forecast_date", { ascending: true })
      .limit(7);

    if (error) throw error;

    return ((data as DbWeatherForecastRow[]) || []).map(mapWeatherForecast);
  } catch (error) {
    console.error("[supabase:getCachedWeather]", error);
    return [];
  }
}

export async function upsertWeatherForecast(
  locationId: string,
  forecasts: Omit<WeatherForecast, "id" | "locationId" | "fetchedAt">[],
): Promise<void> {
  try {
    const client = requireClient();

    const rows = forecasts.map((f) => ({
      location_id: locationId,
      forecast_date: f.forecastDate,
      temperature_high: f.temperatureHigh,
      temperature_low: f.temperatureLow,
      condition: f.condition,
      rain_probability: f.rainProbability,
      wind_speed: f.windSpeed,
      uv_index: f.uvIndex,
      staffing_suggestion: f.staffingSuggestion,
      inventory_suggestion: f.inventorySuggestion,
      fetched_at: new Date().toISOString(),
    }));

    const { error } = await client
      .from("weather_cache")
      .upsert(rows, {
        onConflict: "location_id,forecast_date",
      });

    if (error) throw error;
  } catch (error) {
    console.error("[supabase:upsertWeatherForecast]", error);
  }
}

// ─────────────────────────────────────────────────
// Dashboard Module
// ─────────────────────────────────────────────────

export async function getDashboardSummary(
  locationId: string,
  today: string,
): Promise<DashboardSummary> {
  try {
    if (!supabaseClient) {
      return {
        todayRevenue: 0,
        todayOrders: 0,
        vsYesterday: 0,
        lowStockCount: 0,
        criticalStockCount: 0,
        todayStaffCount: 0,
        flaggedLogsCount: 0,
        unreadMessagesCount: 0,
      };
    }

    const yesterday = subDays(new Date(today), 1)
      .toISOString()
      .slice(0, 10);
    const weekStart = startOfWeek(new Date(today), {
      weekStartsOn: 1,
    })
      .toISOString()
      .slice(0, 10);

    const [todaySales, yesterdaySales, lowStock, shifts, flagged, channels, weather] =
      await Promise.all([
        getSalesByDay(today, locationId),
        getSalesByDay(yesterday, locationId),
        getLowStockItems(locationId),
        getShiftsByWeek(weekStart, locationId),
        getFlaggedLogs(locationId, 30),
        getChannels(locationId),
        getCachedWeather(locationId),
      ]);

    const vsYesterday =
      yesterdaySales.totalRevenue > 0
        ? Math.round(
            (((todaySales.totalRevenue - yesterdaySales.totalRevenue) /
              yesterdaySales.totalRevenue) *
              100 +
              Number.EPSILON) *
              10,
          ) / 10
        : 0;

    const todayStaffCount = shifts.shifts.filter(
      (s) => s.date === today,
    ).length;

    const flaggedCount = flagged.filter((log) => {
      const logDate = new Date(log.date);
      const sevenDaysAgo = subDays(new Date(), 7);
      return logDate >= sevenDaysAgo;
    }).length;

    const criticalCount = lowStock.filter((item) => item.status === "critical")
      .length;
    const lowCount = lowStock.filter((item) => item.status === "low").length;

    const unreadMessages = channels.reduce(
      (sum, ch) => sum + (ch.unreadCount ?? 0),
      0,
    );

    const weatherToday = weather.find((w) => w.forecastDate === today);

    return {
      todayRevenue: todaySales.totalRevenue,
      todayOrders: todaySales.totalOrders,
      vsYesterday,
      lowStockCount: lowCount,
      criticalStockCount: criticalCount,
      todayStaffCount,
      flaggedLogsCount: flaggedCount,
      unreadMessagesCount: unreadMessages,
      weatherSummary: weatherToday?.staffingSuggestion,
    };
  } catch (error) {
    console.error("[supabase:getDashboardSummary]", error);
    return {
      todayRevenue: 0,
      todayOrders: 0,
      vsYesterday: 0,
      lowStockCount: 0,
      criticalStockCount: 0,
      todayStaffCount: 0,
      flaggedLogsCount: 0,
      unreadMessagesCount: 0,
    };
  }
}

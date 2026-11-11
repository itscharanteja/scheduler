import { addDays, format, startOfWeek } from "date-fns";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Employee,
  WeekSchedule,
  Shift,
  ChatChannel,
  SalesDay,
  DashboardAlert,
  EmployeeActivityItem,
} from "@/lib/types";
import {
  mockAlerts,
  mockChatChannels,
  mockEmployeeActivity,
  mockEmployees,
  mockLogs,
  mockSales,
  mockShifts,
} from "@/lib/mock-data";
import { LOCATION_ID } from "@/lib/constants";

export interface SnapshotTask {
  id: string;
  title: string;
  note: string;
  category: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  dueTime: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DashboardSnapshot {
  employees: Employee[];
  schedule: WeekSchedule;
  tasks: SnapshotTask[];
  channels: ChatChannel[];
  sales: SalesDay[];
  alerts: DashboardAlert[];
  activity: EmployeeActivityItem[];
  timestamp: string;
  degraded?: boolean;
}

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
  employees?: { name: string } | { name: string }[] | null;
};

type DbEmployeeRow = {
  id: string;
  name: string;
  role: string;
  contract_hours: number;
  max_weekly_hours: number;
  employment_type: string;
  phone: string | null;
  location_id: string | null;
  created_at: string;
  hourly_rate: number | null;
};

type DbTaskRow = {
  id: string;
  title: string;
  note: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  assignee_id: string | null;
  assignee?: { id: string; name: string } | null;
  created_by: string | null;
  creator?: { id: string; name: string } | null;
  due_time: string | null;
  created_at: string;
  completed_at: string | null;
};

type DbChannelRow = {
  id: string;
  location_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_announcement: boolean;
  created_at: string;
  created_by: string | null;
  unread_count: number | null;
  participant_count: number | null;
};

type DbSalesRow = {
  id: string;
  date: string;
  revenue: number | string;
  orders: number;
  average_order_value: number | string;
  labor_cost: number | string;
  comparison_revenue: number | string;
  peak_label: string;
  hourly_revenue: number[] | null;
};

type DbAlertRow = {
  id: string;
  tone: string;
  title: string;
  message: string;
};

type DbActivityRow = {
  id: string;
  employee_id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: string;
};

async function getServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const cookieStore = await cookies();
    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options as any)
            );
          } catch {
            // Read-only context in Server Components
          }
        },
      },
    });
  } catch {
    return null;
  }
}

export async function getDashboardSnapshot(
  locationIdInput?: string,
  weekStartInput?: string,
  _userId?: string,
  clientOverride?: SupabaseClient | null
): Promise<DashboardSnapshot> {
  const locationId = locationIdInput || LOCATION_ID;
  const todayKey = new Date().toISOString().split("T")[0];
  const start = startOfWeek(
    weekStartInput ? new Date(`${weekStartInput.slice(0, 10)}T00:00:00`) : new Date(`${todayKey}T00:00:00`),
    { weekStartsOn: 1 }
  );
  const startDateStr = format(start, "yyyy-MM-dd");
  const end = addDays(start, 6);
  const endDateStr = format(end, "yyyy-MM-dd");

  const client = clientOverride || (await getServerSupabaseClient());

  // Fallback to mock data if Supabase is unconfigured
  if (!client) {
    const emp = mockEmployees.filter((e) => !locationId || e.locationId === locationId);
    const sh = mockShifts
      .filter((s) => s.date >= startDateStr && s.date <= endDateStr)
      .filter((s) => !locationId || s.locationId === locationId)
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

    return {
      employees: emp,
      schedule: {
        weekStart: startDateStr,
        locationId,
        shifts: sh,
        status: "draft",
      },
      tasks: mockLogs.map((l) => ({
        id: l.id,
        title: l.title,
        note: l.note ?? "",
        category: l.category ?? "ops",
        priority: l.priority ?? "medium",
        status: l.status ?? "open",
        assigneeId: l.assigneeId ?? null,
        assigneeName: l.assigneeName ?? null,
        createdBy: null,
        createdByName: null,
        dueTime: l.dueTime ?? null,
        createdAt: l.createdAt,
        completedAt: l.completedAt ?? null,
      })),
      channels: mockChatChannels.filter((c) => !locationId || c.locationId === locationId),
      sales: mockSales.filter((s) => !locationId || ("locationId" in s && s.locationId === locationId)),
      alerts: mockAlerts,
      activity: mockEmployeeActivity.slice(0, 5),
      timestamp: new Date().toISOString(),
      degraded: false,
    };
  }

  // Execute queries in parallel using Promise.allSettled for fault tolerance
  let empQuery = client.from("employees").select("*").order("name", { ascending: true }).limit(500);
  if (locationId) empQuery = empQuery.eq("location_id", locationId);

  let shiftQuery = client
    .from("shifts")
    .select("id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai, notes, created_at, employees(name)")
    .gte("date", startDateStr)
    .lte("date", endDateStr)
    .order("date", { ascending: true });
  if (locationId) shiftQuery = shiftQuery.eq("location_id", locationId);

  const taskQuery = client
    .from("tasks")
    .select("*, assignee:assignee_id(id, name), creator:created_by(id, name)")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const channelQuery = client
    .from("chat_channels")
    .select("*")
    .eq("location_id", locationId)
    .order("is_announcement", { ascending: false })
    .order("name", { ascending: true });

  const salesQuery = client
    .from("daily_sales")
    .select("*")
    .eq("location_id", locationId)
    .order("date", { ascending: false })
    .limit(7);

  const alertQuery = client
    .from("dashboard_alerts")
    .select("*")
    .eq("location_id", locationId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  const activityQuery = client
    .from("employee_activity")
    .select("*")
    .eq("location_id", locationId)
    .order("timestamp", { ascending: false })
    .limit(5);

  const [
    employeesRes,
    shiftsRes,
    tasksRes,
    channelsRes,
    salesRes,
    alertsRes,
    activityRes,
  ] = await Promise.allSettled([
    empQuery,
    shiftQuery,
    taskQuery,
    channelQuery,
    salesQuery,
    alertQuery,
    activityQuery,
  ]);

  let degraded = false;

  // Process Employees
  let employees: Employee[] = [];
  if (employeesRes.status === "fulfilled" && !employeesRes.value.error && employeesRes.value.data) {
    employees = (employeesRes.value.data as unknown as DbEmployeeRow[]).map((row) => ({
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
    }));
  } else {
    degraded = true;
    employees = mockEmployees.filter((e) => !locationId || e.locationId === locationId);
  }

  // Process Shifts
  let shifts: Shift[] = [];
  if (shiftsRes.status === "fulfilled" && !shiftsRes.value.error && shiftsRes.value.data) {
    shifts = (shiftsRes.value.data as unknown as DbShiftRow[]).map((row) => {
      let empName = "";
      if (row.employees) {
        empName = Array.isArray(row.employees) ? row.employees[0]?.name ?? "" : row.employees.name;
      }
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: empName,
        role: row.role,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        locationId: row.location_id ?? "",
        status: row.status as Shift["status"],
        createdByAi: row.created_by_ai,
        notes: row.notes ?? undefined,
      };
    });
  } else {
    degraded = true;
    shifts = mockShifts
      .filter((s) => s.date >= startDateStr && s.date <= endDateStr)
      .filter((s) => !locationId || s.locationId === locationId);
  }

  // Process Tasks
  let tasks: SnapshotTask[] = [];
  if (tasksRes.status === "fulfilled" && !tasksRes.value.error && tasksRes.value.data) {
    tasks = (tasksRes.value.data as unknown as DbTaskRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      note: row.note ?? "",
      category: row.category ?? "ops",
      priority: row.priority ?? "medium",
      status: row.status ?? "open",
      assigneeId: row.assignee_id ?? null,
      assigneeName: row.assignee?.name ?? null,
      createdBy: row.created_by ?? null,
      createdByName: row.creator?.name ?? null,
      dueTime: row.due_time ?? null,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
    }));
  } else {
    degraded = true;
    tasks = [];
  }

  // Process Channels
  let channels: ChatChannel[] = [];
  if (channelsRes.status === "fulfilled" && !channelsRes.value.error && channelsRes.value.data) {
    channels = (channelsRes.value.data as unknown as DbChannelRow[]).map((row) => ({
      id: row.id,
      locationId: row.location_id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      isAnnouncement: row.is_announcement,
      createdAt: row.created_at,
      createdBy: row.created_by ?? undefined,
      unreadCount: row.unread_count ?? undefined,
      participantCount: row.participant_count ?? undefined,
    }));
  } else {
    degraded = true;
    channels = [];
  }

  // Process Sales (Auxiliary)
  let sales: SalesDay[] = [];
  if (salesRes.status === "fulfilled" && !salesRes.value.error && salesRes.value.data) {
    sales = (salesRes.value.data as unknown as DbSalesRow[]).map((row) => ({
      id: row.id,
      date: row.date,
      revenue: Number(row.revenue),
      orders: row.orders,
      averageOrderValue: Number(row.average_order_value),
      laborCost: Number(row.labor_cost),
      comparisonRevenue: Number(row.comparison_revenue),
      peakLabel: row.peak_label,
      hourlyRevenue: Array.isArray(row.hourly_revenue) ? row.hourly_revenue : [],
    }));
  } else {
    degraded = true;
    sales = [];
  }

  // Process Alerts (Auxiliary)
  let alerts: DashboardAlert[] = [];
  if (alertsRes.status === "fulfilled" && !alertsRes.value.error && alertsRes.value.data) {
    alerts = (alertsRes.value.data as unknown as DbAlertRow[]).map((row) => ({
      id: row.id,
      tone: row.tone as DashboardAlert["tone"],
      title: row.title,
      message: row.message,
    }));
  } else {
    degraded = true;
    alerts = [];
  }

  // Process Activity (Auxiliary)
  let activity: EmployeeActivityItem[] = [];
  if (activityRes.status === "fulfilled" && !activityRes.value.error && activityRes.value.data) {
    activity = (activityRes.value.data as unknown as DbActivityRow[]).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      type: row.type as EmployeeActivityItem["type"],
      title: row.title,
      detail: row.detail,
      timestamp: row.timestamp,
    }));
  } else {
    degraded = true;
    activity = [];
  }

  return {
    employees,
    schedule: {
      weekStart: startDateStr,
      locationId,
      shifts,
      status: "draft",
    },
    tasks,
    channels,
    sales,
    alerts,
    activity,
    timestamp: new Date().toISOString(),
    degraded,
  };
}

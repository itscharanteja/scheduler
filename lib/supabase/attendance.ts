import { serviceClient } from "@/lib/api-auth";
import { supabaseClient, normalizeSupabaseError } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttendanceSession = {
  id: string;
  employeeId: string;
  locationId: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  createdAt: string;
};

export type KioskEmployee = {
  id: string;
  name: string;
  role: string;
};

type DbSessionRow = {
  id: string;
  employee_id: string;
  location_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  created_at: string;
};

function mapSession(row: DbSessionRow): AttendanceSession {
  return {
    id: row.id,
    employeeId: row.employee_id,
    locationId: row.location_id,
    clockedInAt: row.clocked_in_at,
    clockedOutAt: row.clocked_out_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Kiosk — employee list (uses anon client, same as rest of data layer)
// ---------------------------------------------------------------------------

/**
 * Returns the name + id of all employees at a location for the kiosk grid.
 */
export async function getEmployeesForKiosk(locationId: string): Promise<KioskEmployee[]> {
  try {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("employees")
      .select("id, name, role")
      .eq("location_id", locationId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data as KioskEmployee[]) ?? [];
  } catch (error) {
    throw normalizeSupabaseError(error, "getEmployeesForKiosk");
  }
}

// ---------------------------------------------------------------------------
// Attendance sessions — service role (bypasses RLS for public kiosk writes)
// ---------------------------------------------------------------------------

/**
 * Returns the open (not yet clocked-out) session for an employee, or null.
 */
export async function getActiveSession(employeeId: string): Promise<AttendanceSession | null> {
  try {
    const { data, error } = await serviceClient()
      .from("attendance_sessions")
      .select("*")
      .eq("employee_id", employeeId)
      .is("clocked_out_at", null)
      .order("clocked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data as DbSessionRow) : null;
  } catch (error) {
    throw normalizeSupabaseError(error, "getActiveSession");
  }
}

/**
 * Creates a new clock-in session. Throws if the employee already has an open session.
 */
export async function clockIn(employeeId: string, locationId: string): Promise<AttendanceSession> {
  try {
    const { data, error } = await serviceClient()
      .from("attendance_sessions")
      .insert({ employee_id: employeeId, location_id: locationId })
      .select("*")
      .single();
    if (error) throw error;
    return mapSession(data as DbSessionRow);
  } catch (error) {
    throw normalizeSupabaseError(error, "clockIn");
  }
}

/**
 * Sets clocked_out_at on the given session. Returns the updated session.
 */
export async function clockOut(sessionId: string): Promise<AttendanceSession> {
  try {
    const { data, error } = await serviceClient()
      .from("attendance_sessions")
      .update({ clocked_out_at: new Date().toISOString() })
      .eq("id", sessionId)
      .select("*")
      .single();
    if (error) throw error;
    return mapSession(data as DbSessionRow);
  } catch (error) {
    throw normalizeSupabaseError(error, "clockOut");
  }
}

// ---------------------------------------------------------------------------
// Admin report
// ---------------------------------------------------------------------------

export type AttendanceSessionWithEmployee = AttendanceSession & {
  employeeName: string;
  employeeRole: string;
};

type DbSessionWithEmployee = DbSessionRow & {
  employees: { name: string; role: string } | null;
};

export async function getAttendanceSessions(
  locationId: string,
  opts?: {
    employeeId?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
): Promise<AttendanceSessionWithEmployee[]> {
  try {
    let query = serviceClient()
      .from("attendance_sessions")
      .select("*, employees(name, role)")
      .eq("location_id", locationId)
      .order("clocked_in_at", { ascending: false });

    if (opts?.employeeId) query = query.eq("employee_id", opts.employeeId);
    if (opts?.from) query = query.gte("clocked_in_at", opts.from);
    // Append end-of-day so timestamptz records anywhere in the day are included
    if (opts?.to) query = query.lte("clocked_in_at", opts.to + "T23:59:59");
    if (opts?.limit) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error) throw error;

    return (data as DbSessionWithEmployee[]).map((row) => ({
      ...mapSession(row),
      employeeName: row.employees?.name ?? "Unknown",
      employeeRole: row.employees?.role ?? "",
    }));
  } catch (error) {
    throw normalizeSupabaseError(error, "getAttendanceSessions");
  }
}

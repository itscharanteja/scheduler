import type { EmployeeActivityItem } from "@/lib/types";
import { supabaseClient } from "./client";

type DbEmployeeActivityRow = {
  id: string;
  employee_id: string;
  location_id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: string;
};

function mapEmployeeActivity(row: DbEmployeeActivityRow): EmployeeActivityItem {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type as EmployeeActivityItem["type"],
    title: row.title,
    detail: row.detail,
    timestamp: row.timestamp,
  };
}

export async function getActivity(locationId: string, limit = 20): Promise<EmployeeActivityItem[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("employee_activity")
      .select("*")
      .eq("location_id", locationId)
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as DbEmployeeActivityRow[]).map(mapEmployeeActivity);
  } catch (error) {
    console.error("[supabase:getActivity]", error);
    return [];
  }
}

export async function getEmployeeActivity(
  employeeId: string,
  limit = 6
): Promise<EmployeeActivityItem[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("employee_activity")
      .select("*")
      .eq("employee_id", employeeId)
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as DbEmployeeActivityRow[]).map(mapEmployeeActivity);
  } catch (error) {
    console.error("[supabase:getEmployeeActivity]", error);
    return [];
  }
}

import type { DashboardAlert } from "@/lib/types";
import { supabaseClient, normalizeSupabaseError } from "./client";

type DbDashboardAlertRow = {
  id: string;
  location_id: string;
  tone: string;
  title: string;
  message: string;
  resolved_at: string | null;
  created_at: string;
};

function mapDashboardAlert(row: DbDashboardAlertRow): DashboardAlert {
  return {
    id: row.id,
    tone: row.tone as DashboardAlert["tone"],
    title: row.title,
    message: row.message,
  };
}

export async function getAlerts(locationId: string, signal?: AbortSignal): Promise<DashboardAlert[]> {
  if (!supabaseClient) return [];
  try {
    let query = supabaseClient
      .from("dashboard_alerts")
      .select("*")
      .eq("location_id", locationId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    return (data as DbDashboardAlertRow[]).map(mapDashboardAlert);
  } catch (error) {
    throw normalizeSupabaseError(error, "getAlerts");
  }
}

export async function resolveAlert(alertId: string): Promise<void> {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient
      .from("dashboard_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", alertId);
    if (error) throw error;
  } catch (error) {
    console.error("[supabase:resolveAlert]", error);
  }
}

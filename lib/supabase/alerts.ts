import type { DashboardAlert } from "@/lib/types";
import { supabaseClient } from "./client";

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

export async function getAlerts(locationId: string): Promise<DashboardAlert[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("dashboard_alerts")
      .select("*")
      .eq("location_id", locationId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as DbDashboardAlertRow[]).map(mapDashboardAlert);
  } catch (error) {
    console.error("[supabase:getAlerts]", error);
    return [];
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

import type { SalesDay } from "@/lib/types";
import { supabaseClient } from "./client";

type DbDailySalesRow = {
  id: string;
  location_id: string;
  date: string;
  revenue: number;
  orders: number;
  average_order_value: number;
  labor_cost: number;
  comparison_revenue: number;
  peak_label: string;
  hourly_revenue: number[];
  created_at: string;
};

function mapDailySales(row: DbDailySalesRow): SalesDay {
  return {
    id: row.id,
    date: row.date,
    revenue: Number(row.revenue),
    orders: row.orders,
    averageOrderValue: Number(row.average_order_value),
    laborCost: Number(row.labor_cost),
    comparisonRevenue: Number(row.comparison_revenue),
    peakLabel: row.peak_label,
    hourlyRevenue: Array.isArray(row.hourly_revenue) ? row.hourly_revenue : [],
  };
}

export async function getSales(locationId: string, limit = 7): Promise<SalesDay[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("daily_sales")
      .select("*")
      .eq("location_id", locationId)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as DbDailySalesRow[]).map(mapDailySales);
  } catch (error) {
    console.error("[supabase:getSales]", error);
    return [];
  }
}

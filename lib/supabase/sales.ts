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
  let sales: SalesDay[] = [];
  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("daily_sales")
        .select("*")
        .eq("location_id", locationId)
        .order("date", { ascending: false })
        .limit(limit);
      if (!error && data) {
        sales = (data as DbDailySalesRow[]).map(mapDailySales);
      }
    }
  } catch (error) {
    console.error("[supabase:getSales]", error);
  }

  // Merge live simulator data if running
  try {
    let simMetrics: any = null;
    let todayStr = new Date().toISOString().split("T")[0];
    let comparisonRevenue = 49200;

    if (typeof window !== "undefined") {
      // Browser runtime: fetch live server simulator metrics
      const res = await fetch("/api/sim/status");
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          simMetrics = data.metrics;
          todayStr = (data.currentTime || new Date().toISOString()).split("T")[0];
          comparisonRevenue = data.comparisonRevenue || 49200;
        }
      }
    } else {
      // Server runtime: access simulator engine singleton directly
      const { getSimulator } = await import("@/lib/simulator/engine");
      const sim = getSimulator();
      simMetrics = sim.getStatus().metrics;
      todayStr = sim.currentTime.toISOString().split("T")[0];
      comparisonRevenue = sim.comparisonRevenue;
    }

    if (simMetrics) {
      const todayIndex = sales.findIndex((s) => s.date === todayStr);
      if (todayIndex >= 0) {
        sales[todayIndex] = {
          ...sales[todayIndex],
          revenue: simMetrics.todayRevenue,
          orders: simMetrics.todayOrders,
          averageOrderValue: simMetrics.averageOrderValue,
          laborCost: simMetrics.laborCost,
          peakLabel: simMetrics.peakLabel,
          hourlyRevenue: simMetrics.hourlyRevenue,
        };
      } else {
        sales.unshift({
          id: "sim-today",
          date: todayStr,
          revenue: simMetrics.todayRevenue,
          orders: simMetrics.todayOrders,
          averageOrderValue: simMetrics.averageOrderValue,
          laborCost: simMetrics.laborCost,
          comparisonRevenue,
          peakLabel: simMetrics.peakLabel,
          hourlyRevenue: simMetrics.hourlyRevenue,
        });
      }
    }
  } catch {
    // Simulator optional
  }

  return sales.slice(0, limit);
}

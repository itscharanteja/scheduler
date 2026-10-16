import { supabaseClient, requireClient } from "./client";

export interface AppInventoryItem {
  id: string;
  locationId: string;
  itemName: string;
  currentStock: number;
  criticalThreshold: number;
  lowThreshold: number;
  unit: string;
  status: "ok" | "low" | "critical";
  lastUpdated?: string;
  updatedBy?: string;
}

export function mapInventoryItem(row: any): AppInventoryItem {
  const currentStock = Number(row.current_stock ?? row.currentStock ?? row.stock_level ?? row.stockLevel ?? 0);
  const criticalThreshold = Number(row.critical_threshold ?? row.criticalThreshold ?? row.threshold ?? 10);
  const lowThreshold = Number(row.low_threshold ?? row.lowThreshold ?? criticalThreshold * 2);
  
  let status: "ok" | "low" | "critical" = "ok";
  if (row.status === "critical" || row.status === "low" || row.status === "ok") {
    status = row.status;
  } else if (currentStock <= criticalThreshold) {
    status = "critical";
  } else if (currentStock <= lowThreshold) {
    status = "low";
  }

  return {
    id: row.id || `inv-${(row.item_name || row.itemName || row.name || "item").toLowerCase().replace(/\s+/g, "-")}`,
    locationId: row.location_id || row.locationId || "",
    itemName: row.item_name || row.itemName || row.name || "Unknown Item",
    currentStock,
    criticalThreshold,
    lowThreshold,
    unit: row.unit || "pcs",
    status,
    lastUpdated: row.last_updated || row.lastUpdated || row.updated_at || row.updatedAt,
    updatedBy: row.updated_by || row.updatedBy,
  };
}

export async function getInventory(locationId: string): Promise<AppInventoryItem[]> {
  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("inventory")
        .select("*")
        .eq("location_id", locationId)
        .order("item_name", { ascending: true });
      if (!error && data && data.length > 0) {
        return data.map(mapInventoryItem);
      }
    }
  } catch (error) {
    console.error("[supabase:getInventory]", error);
  }

  // Fallback to simulator inventory
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/inventory?locationId=${locationId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          return data.items.map(mapInventoryItem);
        }
      }
      const simRes = await fetch("/api/sim/status");
      if (simRes.ok) {
        const data = await simRes.json();
        if (Array.isArray(data.inventory)) {
          return data.inventory.map((inv: any) => ({
            id: inv.id,
            locationId,
            itemName: inv.name,
            currentStock: inv.currentStock,
            criticalThreshold: inv.criticalThreshold,
            lowThreshold: inv.lowThreshold,
            unit: inv.unit,
            status: inv.status,
            lastUpdated: new Date().toISOString(),
            updatedBy: "simulation",
          }));
        }
      }
    } catch {
      // Fallback failed
    }
    return [];
  }

  const { getSimulator } = await import("@/lib/simulator/engine");
  const sim = getSimulator();
  return Array.from(sim.inventory.values()).map((inv) => ({
    id: inv.id,
    locationId,
    itemName: inv.name,
    currentStock: inv.currentStock,
    criticalThreshold: inv.criticalThreshold,
    lowThreshold: inv.lowThreshold,
    unit: inv.unit,
    status: inv.status,
    lastUpdated: new Date().toISOString(),
    updatedBy: "simulation",
  }));
}

export async function getLowStockItems(locationId: string): Promise<AppInventoryItem[]> {
  try {
    const items = await getInventory(locationId);
    return items.filter((item) => item.status !== "ok");
  } catch (error) {
    console.error("[supabase:getLowStockItems]", error);
    return [];
  }
}

export async function updateInventoryItem(payload: any): Promise<any | null> {
  try {
    // Update active simulator singleton on server
    if (typeof window === "undefined") {
      const { getSimulator } = await import("@/lib/simulator/engine");
      const sim = getSimulator();
      if (payload.name) {
        sim.restockItem(payload.name, Number(payload.newStock));
      }
    }

    if (supabaseClient) {
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
      if (!error && data) return data;
    }
    return { id: payload.id, current_stock: payload.newStock };
  } catch (error) {
    console.error("[supabase:updateInventoryItem]", error);
    return { id: payload.id, current_stock: payload.newStock };
  }
}

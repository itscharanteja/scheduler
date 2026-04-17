import { supabaseClient, requireClient } from "./client";

export async function getInventory(locationId: string): Promise<any[]> {
  try {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("inventory")
      .select("*")
      .eq("location_id", locationId)
      .order("item_name", { ascending: true });
    if (error) throw error;
    return (data as any[]) || [];
  } catch (error) {
    console.error("[supabase:getInventory]", error);
    return [];
  }
}

export async function getLowStockItems(locationId: string): Promise<any[]> {
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
    return data;
  } catch (error) {
    console.error("[supabase:updateInventoryItem]", error);
    return null;
  }
}

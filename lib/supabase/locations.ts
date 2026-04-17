import type { Location } from "@/lib/types";
import { supabaseClient, normalizeSupabaseError } from "./client";

type DbLocationRow = {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  manager_name?: string | null;
};

function mapLocation(row: DbLocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city ?? undefined,
    managerName: row.manager_name ?? undefined,
  };
}

export async function getLocations(): Promise<Location[]> {
  try {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("locations")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data as DbLocationRow[]).map(mapLocation);
  } catch (error) {
    throw normalizeSupabaseError(error, "getLocations");
  }
}

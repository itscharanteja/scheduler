import { supabaseClient, requireClient } from "./client";

export interface ChecklistTemplate {
  id: string;
  locationId: string;
  shiftType: "morning" | "evening";
  items: string[];
  updatedAt: string | null;
}

export interface ChecklistSubmission {
  id: string;
  locationId: string;
  shiftType: "morning" | "evening";
  date: string;
  submittedBy: string | null;
  checkedItems: boolean[];
  isComplete: boolean;
  submittedAt: string;
}

export async function getChecklistTemplate(
  locationId: string,
  shiftType: "morning" | "evening"
): Promise<ChecklistTemplate | null> {
  try {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from("shift_checklist_templates")
      .select("*")
      .eq("location_id", locationId)
      .eq("shift_type", shiftType)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    const row = data as { id: string; location_id: string; shift_type: string; items: unknown; updated_at: string | null };
    return {
      id: row.id,
      locationId: row.location_id,
      shiftType: row.shift_type as "morning" | "evening",
      items: Array.isArray(row.items) ? (row.items as string[]) : [],
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error("[supabase:getChecklistTemplate]", error);
    return null;
  }
}

export async function upsertChecklistTemplate(
  locationId: string,
  shiftType: "morning" | "evening",
  items: string[]
): Promise<boolean> {
  try {
    const client = requireClient();
    const { error } = await client
      .from("shift_checklist_templates")
      .upsert(
        { location_id: locationId, shift_type: shiftType, items, updated_at: new Date().toISOString() },
        { onConflict: "location_id,shift_type" }
      );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[supabase:upsertChecklistTemplate]", error);
    return false;
  }
}

export async function getChecklistSubmission(
  locationId: string,
  shiftType: "morning" | "evening",
  date: string
): Promise<ChecklistSubmission | null> {
  try {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from("shift_checklist_submissions")
      .select("*")
      .eq("location_id", locationId)
      .eq("shift_type", shiftType)
      .eq("date", date)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    const row = data as {
      id: string; location_id: string; shift_type: string; date: string;
      submitted_by: string | null; checked_items: unknown; is_complete: boolean; submitted_at: string;
    };
    return {
      id: row.id,
      locationId: row.location_id,
      shiftType: row.shift_type as "morning" | "evening",
      date: row.date,
      submittedBy: row.submitted_by,
      checkedItems: Array.isArray(row.checked_items) ? (row.checked_items as boolean[]) : [],
      isComplete: row.is_complete,
      submittedAt: row.submitted_at,
    };
  } catch (error) {
    console.error("[supabase:getChecklistSubmission]", error);
    return null;
  }
}

export async function saveChecklistSubmission(
  locationId: string,
  shiftType: "morning" | "evening",
  date: string,
  submittedBy: string,
  checkedItems: boolean[],
  isComplete: boolean
): Promise<ChecklistSubmission | null> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from("shift_checklist_submissions")
      .upsert(
        {
          location_id: locationId,
          shift_type: shiftType,
          date,
          submitted_by: submittedBy,
          checked_items: checkedItems,
          is_complete: isComplete,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "location_id,shift_type,date" }
      )
      .select("*")
      .single();
    if (error) throw error;
    const row = data as {
      id: string; location_id: string; shift_type: string; date: string;
      submitted_by: string | null; checked_items: unknown; is_complete: boolean; submitted_at: string;
    };
    return {
      id: row.id,
      locationId: row.location_id,
      shiftType: row.shift_type as "morning" | "evening",
      date: row.date,
      submittedBy: row.submitted_by,
      checkedItems: Array.isArray(row.checked_items) ? (row.checked_items as boolean[]) : [],
      isComplete: row.is_complete,
      submittedAt: row.submitted_at,
    };
  } catch (error) {
    console.error("[supabase:saveChecklistSubmission]", error);
    return null;
  }
}

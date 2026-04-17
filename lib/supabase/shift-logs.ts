import { supabaseClient, requireClient } from "./client";

export async function getShiftLogs(locationId: string, limit?: number): Promise<any[]> {
  try {
    if (!supabaseClient) return [];
    let query = supabaseClient
      .from("shift_logs")
      .select("*, leader:shift_leader_id(id, name)")
      .eq("location_id", locationId)
      .order("date", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      locationId: row.location_id,
      date: row.date,
      shiftLeaderId: row.shift_leader_id,
      shiftLeaderName: row.leader?.name ?? null,
      shiftType: row.shift_type,
      notes: row.notes ?? "",
      issuesFlagged: row.issues_flagged ?? false,
      tasksCompleted: Array.isArray(row.tasks_completed) ? row.tasks_completed : [],
      tasksPending: Array.isArray(row.tasks_pending) ? row.tasks_pending : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null,
    }));
  } catch (error) {
    console.error("[supabase:getShiftLogs]", error);
    return [];
  }
}

export async function createShiftLog(payload: any): Promise<any | null> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from("shift_logs")
      .insert({
        location_id: payload.locationId,
        date: payload.date,
        shift_leader_id: payload.shiftLeaderId,
        shift_type: payload.shiftType,
        notes: payload.notes,
        issues_flagged: payload.issuesFlagged ?? false,
        tasks_completed: payload.tasksCompleted ?? [],
        tasks_pending: payload.tasksPending ?? [],
      })
      .select("*, leader:shift_leader_id(id, name)")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      locationId: data.location_id,
      date: data.date,
      shiftLeaderId: data.shift_leader_id,
      shiftLeaderName: (data.leader as any)?.name ?? null,
      shiftType: data.shift_type,
      notes: data.notes ?? "",
      issuesFlagged: data.issues_flagged ?? false,
      tasksCompleted: Array.isArray(data.tasks_completed) ? data.tasks_completed : [],
      tasksPending: Array.isArray(data.tasks_pending) ? data.tasks_pending : [],
      createdAt: data.created_at,
      updatedAt: data.updated_at ?? null,
    };
  } catch (error) {
    console.error("[supabase:createShiftLog]", error);
    return null;
  }
}

export async function updateShiftLog(id: string, payload: any): Promise<any | null> {
  try {
    const client = requireClient();
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (payload.notes !== undefined) updatePayload.notes = payload.notes;
    if (payload.issuesFlagged !== undefined) updatePayload.issues_flagged = payload.issuesFlagged;
    if (payload.tasksCompleted !== undefined) updatePayload.tasks_completed = payload.tasksCompleted;
    if (payload.tasksPending !== undefined) updatePayload.tasks_pending = payload.tasksPending;
    const { data, error } = await client
      .from("shift_logs")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[supabase:updateShiftLog]", error);
    return null;
  }
}

export async function getShiftLogsByDate(locationId: string, date: string): Promise<any[]> {
  try {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("shift_logs")
      .select("*")
      .eq("location_id", locationId)
      .eq("date", date)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("[supabase:getShiftLogsByDate]", error);
    return [];
  }
}

export async function getFlaggedLogs(locationId: string, limit?: number): Promise<any[]> {
  try {
    if (!supabaseClient) return [];
    let query = supabaseClient
      .from("shift_logs")
      .select("*, leader:shift_leader_id(id, name)")
      .eq("location_id", locationId)
      .eq("issues_flagged", true)
      .order("created_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("[supabase:getFlaggedLogs]", error);
    return [];
  }
}

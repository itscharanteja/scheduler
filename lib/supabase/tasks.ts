import { supabaseClient, requireClient } from "./client";

export async function getTasks(
  locationId: string,
  filter?: { assigneeId?: string; createdBy?: string }
): Promise<any[]> {
  try {
    if (!supabaseClient) return [];
    let query = supabaseClient
      .from("tasks")
      .select("*, assignee:assignee_id(id, name), creator:created_by(id, name)")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false });

    if (filter?.assigneeId && filter?.createdBy) {
      query = query
        .not("assignee_id", "is", null)
        .or(`assignee_id.eq.${filter.assigneeId},created_by.eq.${filter.createdBy}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      note: row.note ?? "",
      category: row.category ?? "ops",
      priority: row.priority ?? "medium",
      status: row.status ?? "open",
      assigneeId: row.assignee_id ?? null,
      assigneeName: row.assignee?.name ?? null,
      createdBy: row.created_by ?? null,
      createdByName: row.creator?.name ?? null,
      dueTime: row.due_time ?? null,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
    }));
  } catch (error) {
    console.error("[supabase:getTasks]", error);
    return [];
  }
}

export async function createTask(payload: {
  locationId: string;
  title: string;
  note?: string;
  category?: string;
  priority?: string;
  assigneeId?: string | null;
  createdBy?: string | null;
  dueTime?: string | null;
}): Promise<any | null> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from("tasks")
      .insert({
        location_id: payload.locationId,
        title: payload.title,
        note: payload.note ?? "",
        category: payload.category ?? "ops",
        priority: payload.priority ?? "medium",
        status: "open",
        assignee_id: payload.assigneeId ?? null,
        created_by: payload.createdBy ?? null,
        due_time: payload.dueTime ?? null,
      })
      .select("*, assignee:assignee_id(id, name), creator:created_by(id, name)")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      note: data.note ?? "",
      category: data.category ?? "ops",
      priority: data.priority ?? "medium",
      status: data.status ?? "open",
      assigneeId: data.assignee_id ?? null,
      assigneeName: (data.assignee as any)?.name ?? null,
      createdBy: data.created_by ?? null,
      createdByName: (data.creator as any)?.name ?? null,
      dueTime: data.due_time ?? null,
      createdAt: data.created_at,
      completedAt: data.completed_at ?? null,
    };
  } catch (error) {
    console.error("[supabase:createTask]", error);
    return null;
  }
}

export async function updateTask(
  id: string,
  payload: { status?: string; assigneeId?: string | null; dueTime?: string | null }
): Promise<void> {
  try {
    const client = requireClient();
    const update: Record<string, any> = {};
    if (payload.status !== undefined) update.status = payload.status;
    if (payload.assigneeId !== undefined) update.assignee_id = payload.assigneeId;
    if (payload.dueTime !== undefined) update.due_time = payload.dueTime;
    if (payload.status === "done") update.completed_at = new Date().toISOString();
    const { error } = await client.from("tasks").update(update).eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("[supabase:updateTask]", error);
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    const client = requireClient();
    const { error } = await client.from("tasks").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("[supabase:deleteTask]", error);
  }
}

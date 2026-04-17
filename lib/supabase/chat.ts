import type { ChatChannel, ChatMessage, ChannelMember } from "@/lib/types";
import { supabaseClient, requireClient } from "./client";

type DbChatChannelRow = {
  id: string;
  location_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_announcement: boolean;
  created_at: string;
  created_by?: string | null;
  unread_count?: number | null;
  participant_count?: number | null;
};

type DbChatMessageRow = {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_pinned?: boolean;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  employees?: { name: string; role: string } | null;
};

type DbChannelMemberRow = {
  id: string;
  channel_id: string;
  employee_id: string;
  added_at: string;
  employees?: { name: string; role: string } | null;
};

function mapChatChannel(row: DbChatChannelRow): ChatChannel {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    isAnnouncement: row.is_announcement,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    unreadCount: row.unread_count ?? undefined,
    participantCount: row.participant_count ?? undefined,
  };
}

function mapChatMessage(row: DbChatMessageRow): ChatMessage {
  const employeeData = row.employees
    ? Array.isArray(row.employees) ? row.employees[0] : row.employees
    : null;
  return {
    id: row.id,
    channelId: row.channel_id,
    employeeId: row.sender_id,
    employeeName: employeeData?.name ?? "Unknown",
    employeeRole: employeeData?.role ?? "Staff",
    content: row.message,
    timestamp: row.created_at,
    isPinned: row.is_pinned ?? false,
    isEdited: row.is_edited ?? false,
    editedAt: row.edited_at ?? undefined,
    isDeleted: row.is_deleted ?? false,
  };
}

function mapChannelMember(row: DbChannelMemberRow): ChannelMember {
  const employeeData = row.employees
    ? Array.isArray(row.employees) ? row.employees[0] : row.employees
    : null;
  return {
    id: row.id,
    channelId: row.channel_id,
    employeeId: row.employee_id,
    employeeName: employeeData?.name ?? "Unknown",
    employeeRole: employeeData?.role ?? "Staff",
    addedAt: row.added_at,
  };
}

export async function getChannels(locationId: string): Promise<ChatChannel[]> {
  try {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("chat_channels")
      .select("*")
      .eq("location_id", locationId);
    if (error) throw error;
    return (data as DbChatChannelRow[]).map(mapChatChannel);
  } catch (error) {
    console.error("[supabase:getChannels]", error);
    return [];
  }
}

export async function sendMessage(payload: {
  channelId: string;
  senderId: string;
  message: string;
}): Promise<ChatMessage | null> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from("chat_messages")
      .insert({
        channel_id: payload.channelId,
        sender_id: payload.senderId,
        message: payload.message,
        created_at: new Date().toISOString(),
      })
      .select("id, channel_id, sender_id, message, created_at, employees(name, role)")
      .single();
    if (error) throw error;
    return mapChatMessage(data as unknown as DbChatMessageRow);
  } catch (error) {
    console.error("[supabase:sendMessage]", error);
    return null;
  }
}

export async function getMessages(channelId: string, limit?: number): Promise<ChatMessage[]> {
  try {
    if (!supabaseClient) return [];
    let query = supabaseClient
      .from("chat_messages")
      .select("id, channel_id, sender_id, message, created_at, is_pinned, is_edited, edited_at, is_deleted, employees(name, role)")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as DbChatMessageRow[]).map(mapChatMessage);
  } catch (error) {
    console.error("[supabase:getMessages]", error);
    return [];
  }
}

export async function pinMessage(messageId: string, isPinned: boolean): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("chat_messages")
    .update({ is_pinned: isPinned })
    .eq("id", messageId);
  if (error) throw error;
}

export async function editMessage(messageId: string, content: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("chat_messages")
    .update({ message: content, is_edited: true, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("chat_messages")
    .update({ is_deleted: true })
    .eq("id", messageId);
  if (error) throw error;
}

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  try {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("channel_members")
      .select("id, channel_id, employee_id, added_at, employees!channel_members_employee_id_fkey(name, role)")
      .eq("channel_id", channelId)
      .order("added_at", { ascending: true });
    if (error) throw error;
    return (data as unknown as DbChannelMemberRow[]).map(mapChannelMember);
  } catch (error) {
    console.error("[supabase:getChannelMembers]", error);
    return [];
  }
}

export async function addChannelMember(
  channelId: string,
  employeeId: string,
  addedBy?: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("channel_members")
    .insert({ channel_id: channelId, employee_id: employeeId, added_by: addedBy ?? null });
  if (error && error.code !== "23505") throw error; // ignore duplicate
}

export async function removeChannelMember(channelId: string, employeeId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("channel_members")
    .delete()
    .eq("channel_id", channelId)
    .eq("employee_id", employeeId);
  if (error) throw error;
}

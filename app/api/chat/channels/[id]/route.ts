/*
  PATCH  /api/chat/channels/[id]  — edit name/description  { name, description, requesterId, isSuperAdmin }
  DELETE /api/chat/channels/[id]  — delete channel          { requesterId, isSuperAdmin }

  Permission rules:
  - Creator can always edit/delete their own channel
  - super_admin can edit/delete any channel
  - admin can only edit/delete channels they created
*/

import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolvePermission(
  channelId: string,
  requesterId: string,
  isSuperAdmin: boolean
): Promise<{ allowed: boolean; error?: string }> {
  if (!supabaseClient) return { allowed: false, error: "Supabase not configured" };

  const { data, error } = await supabaseClient
    .from("chat_channels")
    .select("created_by")
    .eq("id", channelId)
    .single();

  if (error || !data) return { allowed: false, error: "Channel not found" };

  const createdBy = (data as { created_by: string | null }).created_by;

  // super_admin can do anything
  if (isSuperAdmin) return { allowed: true };

  // creator can manage their own channel
  if (createdBy && createdBy === requesterId) return { allowed: true };

  return { allowed: false, error: "Not authorised" };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, requesterId, isSuperAdmin } = body as {
      name?: string;
      description?: string;
      requesterId: string;
      isSuperAdmin?: boolean;
    };

    if (!id || !requesterId) {
      return NextResponse.json({ error: "id and requesterId are required" }, { status: 400 });
    }

    const { allowed, error: permError } = await resolvePermission(id, requesterId, !!isSuperAdmin);
    if (!allowed) return NextResponse.json({ error: permError ?? "Not authorised" }, { status: 403 });

    if (!supabaseClient) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const updates: Record<string, unknown> = {};
    if (name?.trim()) {
      updates.name = name.trim();
      updates.slug = generateSlug(name.trim());
    }
    if (description !== undefined) {
      updates.description = description.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseClient
      .from("chat_channels")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A channel with that name already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, channel: data });
  } catch (error) {
    console.error("[chat/channels/[id] PATCH]", error);
    return NextResponse.json({ error: "Failed to update channel" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { requesterId, isSuperAdmin } = body as {
      requesterId: string;
      isSuperAdmin?: boolean;
    };

    if (!id || !requesterId) {
      return NextResponse.json({ error: "id and requesterId are required" }, { status: 400 });
    }

    const { allowed, error: permError } = await resolvePermission(id, requesterId, !!isSuperAdmin);
    if (!allowed) return NextResponse.json({ error: permError ?? "Not authorised" }, { status: 403 });

    if (!supabaseClient) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const { error } = await supabaseClient
      .from("chat_channels")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat/channels/[id] DELETE]", error);
    return NextResponse.json({ error: "Failed to delete channel" }, { status: 500 });
  }
}

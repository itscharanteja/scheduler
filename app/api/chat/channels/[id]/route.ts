/*
  PATCH  /api/chat/channels/[id]  — edit name/description  { name, description }
  DELETE /api/chat/channels/[id]  — delete channel

  Permission rules (enforced server-side via session, not client-supplied flags):
  - Creator can always edit/delete their own channel
  - super_admin can edit/delete any channel
  - admin can only edit/delete channels they created
*/

import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolvePermission(
  channelId: string,
  callerId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (!supabaseClient) return false;
  if (isSuperAdmin) return true;

  const { data, error } = await supabaseClient
    .from("chat_channels")
    .select("created_by")
    .eq("id", channelId)
    .single();

  if (error || !data) return false;
  const createdBy = (data as { created_by: string | null }).created_by;
  return !!createdBy && createdBy === callerId;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    if (!id) {
      return NextResponse.json({ error: "Channel id is required" }, { status: 400 });
    }

    const allowed = await resolvePermission(id, caller.userId, caller.role === "super_admin");
    if (!allowed) return forbidden();

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

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
        return NextResponse.json(
          { error: "A channel with that name already exists" },
          { status: 409 },
        );
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
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Channel id is required" }, { status: 400 });
    }

    const allowed = await resolvePermission(id, caller.userId, caller.role === "super_admin");
    if (!allowed) return forbidden();

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

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

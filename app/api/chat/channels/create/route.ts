/*
  POST /api/chat/channels/create
  Creates a new chat channel. Requires admin or super_admin.
  Body: { locationId, name, description?, isAnnouncement? }
  Channel creator is derived from the session — not trusted from the body.
*/

import { NextRequest, NextResponse } from "next/server";
import type { ChatChannel } from "@/lib/types";
import { supabaseClient } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const body = await request.json();
    const { locationId, name, description, isAnnouncement } = body;

    if (!locationId || !name) {
      return NextResponse.json(
        { error: "locationId and name are required", success: false },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json(
        { error: "Supabase client is not configured", success: false },
        { status: 500 },
      );
    }

    const { data, error } = await supabaseClient
      .from("chat_channels")
      .insert({
        location_id: locationId,
        name,
        slug: generateSlug(name),
        description: description || null,
        is_announcement: isAnnouncement || false,
        created_by: caller.employeeId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A channel with that name already exists", success: false },
          { status: 409 },
        );
      }
      throw error;
    }

    const row = data as {
      id: string; location_id: string; name: string; slug: string;
      description: string | null; is_announcement: boolean;
      created_at: string; created_by: string | null;
    };

    const channel: ChatChannel = {
      id: row.id,
      locationId: row.location_id,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      isAnnouncement: row.is_announcement,
      createdAt: row.created_at,
      createdBy: row.created_by ?? undefined,
    };

    return NextResponse.json({ channel, success: true }, { status: 201 });
  } catch (error) {
    console.error("[chat/channels/create]", error);
    return NextResponse.json(
      { error: "Failed to create channel", success: false },
      { status: 500 },
    );
  }
}

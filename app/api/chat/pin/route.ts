/*
  PATCH /api/chat/pin
  Toggles pin status on a message. Requires admin, super_admin, or user_lead.
  Body: { messageId, isPinned }
*/

import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin", "user_lead")) return forbidden();

  try {
    const body = await request.json();
    const { messageId, isPinned } = body;

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase client is not configured" }, { status: 500 });
    }

    const { error } = await supabaseClient
      .from("chat_messages")
      .update({ is_pinned: isPinned })
      .eq("id", messageId);

    if (error) throw error;

    return NextResponse.json({ success: true, messageId, isPinned });
  } catch (error) {
    console.error("[chat/pin]", error);
    return NextResponse.json({ error: "Failed to pin message" }, { status: 500 });
  }
}

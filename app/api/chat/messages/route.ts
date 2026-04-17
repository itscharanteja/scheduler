/*
  GET    /api/chat/messages?channelId=xxx&limit=50
  PATCH  /api/chat/messages  — edit a message   { messageId, content }
  DELETE /api/chat/messages  — delete a message  { messageId }

  Sender identity and admin status are derived from the session cookie,
  not trusted from the request body.
*/

import { NextRequest, NextResponse } from "next/server";
import { getMessages, editMessage, deleteMessage } from "@/lib/supabase";
import { supabaseClient } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();

  try {
    const channelId = request.nextUrl.searchParams.get("channelId");
    const limitStr = request.nextUrl.searchParams.get("limit");

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const limit = Math.min(parseInt(limitStr || "50", 10) || 50, 100);
    const messages = await getMessages(channelId, limit);

    return NextResponse.json({ messages, channelId, count: messages.length });
  } catch (error) {
    console.error("[chat/messages GET]", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();

  try {
    const body = await request.json();
    const { messageId, content } = body as { messageId: string; content: string };

    if (!messageId || !content?.trim()) {
      return NextResponse.json(
        { error: "messageId and content are required" },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Verify ownership — only the sender can edit their own message
    const { data: msg } = await supabaseClient
      .from("chat_messages")
      .select("sender_id")
      .eq("id", messageId)
      .single();

    if (!msg || msg.sender_id !== caller.employeeId) {
      return forbidden();
    }

    await editMessage(messageId, content.trim());
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("[chat/messages PATCH]", error);
    return NextResponse.json({ error: "Failed to edit message" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();

  try {
    const body = await request.json();
    const { messageId } = body as { messageId: string };

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const isAdmin = hasRole(caller, "admin", "super_admin", "user_lead");

    // Non-admins can only delete their own messages
    if (!isAdmin) {
      const { data: msg } = await supabaseClient
        .from("chat_messages")
        .select("sender_id")
        .eq("id", messageId)
        .single();

      if (!msg || msg.sender_id !== caller.employeeId) {
        return forbidden();
      }
    }

    await deleteMessage(messageId);
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("[chat/messages DELETE]", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}

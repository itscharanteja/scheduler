/*
  GET  /api/chat/messages?channelId=xxx&limit=50
  PATCH /api/chat/messages  — edit a message  { messageId, content, senderId }
  DELETE /api/chat/messages — delete a message { messageId, senderId, isAdmin }
*/

import { NextRequest, NextResponse } from "next/server";
import { getMessages, editMessage, deleteMessage } from "@/lib/supabase";
import { supabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId");
    const limitStr = request.nextUrl.searchParams.get("limit");

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    const limit = Math.min(
      parseInt(limitStr || "50", 10) || 50,
      100,
    );

    const messages = await getMessages(channelId, limit);

    return NextResponse.json({
      messages,
      channelId,
      count: messages.length,
    });
  } catch (error) {
    console.error("[chat/messages GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { messageId, content, senderId } = body as {
      messageId: string;
      content: string;
      senderId: string;
    };

    if (!messageId || !content?.trim() || !senderId) {
      return NextResponse.json(
        { error: "messageId, content, and senderId are required" },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Verify ownership — only sender can edit their own message
    const { data: msg } = await supabaseClient
      .from("chat_messages")
      .select("sender_id")
      .eq("id", messageId)
      .single();

    if (!msg || msg.sender_id !== senderId) {
      return NextResponse.json({ error: "Not authorised to edit this message" }, { status: 403 });
    }

    await editMessage(messageId, content.trim());

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("[chat/messages PATCH]", error);
    return NextResponse.json({ error: "Failed to edit message" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { messageId, senderId, isAdmin } = body as {
      messageId: string;
      senderId: string;
      isAdmin?: boolean;
    };

    if (!messageId || !senderId) {
      return NextResponse.json(
        { error: "messageId and senderId are required" },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Non-admins can only delete their own messages
    if (!isAdmin) {
      const { data: msg } = await supabaseClient
        .from("chat_messages")
        .select("sender_id")
        .eq("id", messageId)
        .single();

      if (!msg || msg.sender_id !== senderId) {
        return NextResponse.json({ error: "Not authorised to delete this message" }, { status: 403 });
      }
    }

    await deleteMessage(messageId);

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("[chat/messages DELETE]", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}

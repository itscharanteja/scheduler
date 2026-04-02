/*
  GET /api/chat/pinned?channelId=xxx
  Returns all pinned messages for a channel
*/

import { NextRequest, NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/types";
import { supabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json(
        { error: "Supabase client is not configured" },
        { status: 500 },
      );
    }

    const { data, error } = await supabaseClient
      .from("chat_messages")
      .select("*")
      .eq("channel_id", channelId)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const messages = (data || []) as Array<{
      id: string;
      channel_id: string;
      sender_id: string;
      message: string;
      is_pinned: boolean;
      created_at: string;
    }>;

    // Fetch sender details
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const { data: employees } = await supabaseClient
      .from("employees")
      .select("id, name, position")
      .in("id", senderIds);

    const employeeMap = new Map(
      ((employees as { id: string; name: string; position: string }[]) || []).map(
        (e) => [e.id, { name: e.name, position: e.position }],
      ),
    );

    const pinnedMessages: ChatMessage[] = messages.map((msg) => {
      const sender = employeeMap.get(msg.sender_id);
      return {
        id: msg.id,
        channelId: msg.channel_id,
        employeeId: msg.sender_id,
        employeeName: sender?.name ?? "Unknown",
        employeeRole: sender?.position ?? "Staff",
        content: msg.message,
        timestamp: msg.created_at,
      };
    });

    return NextResponse.json({
      pinned: pinnedMessages,
      count: pinnedMessages.length,
    });
  } catch (error) {
    console.error("[chat/pinned]", error);
    return NextResponse.json(
      { error: "Failed to fetch pinned messages" },
      { status: 500 },
    );
  }
}

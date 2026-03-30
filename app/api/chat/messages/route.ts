/*
  GET /api/chat/messages?channelId=xxx&limit=50
  Returns messages for a channel
  oldest first so chat reads top to bottom
*/

import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/supabase";

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
    console.error("[chat/messages]", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

/*
  POST /api/chat/send
  Sends a new message to a channel
  Body: { channelId, senderId, message }
*/

import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/supabase";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { channelId, senderId, message } = body;

    if (!channelId || !senderId || !message || message.trim() === "") {
      return NextResponse.json(
        { error: "channelId, senderId and message are required" },
        { status: 400 },
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: "Message too long. Maximum 1000 characters." },
        { status: 400 },
      );
    }

    const result = await sendMessage({
      channelId,
      senderId,
      message: message.trim(),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to send message", success: false },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: result,
        success: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[chat/send]", error);
    return NextResponse.json(
      { error: "Failed to send message", success: false },
      { status: 500 },
    );
  }
}

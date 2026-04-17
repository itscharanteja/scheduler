/*
  POST /api/chat/send
  Sends a new message to a channel.
  Body: { channelId, message }
  Sender is derived from the session — not trusted from the body.
*/

import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/supabase";
import { getCallerSession, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();

  if (!caller.employeeId) {
    return NextResponse.json(
      { error: "Your account is not linked to an employee record" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { channelId, message } = body;

    if (!channelId || !message || message.trim() === "") {
      return NextResponse.json(
        { error: "channelId and message are required" },
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
      senderId: caller.employeeId,
      message: message.trim(),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to send message", success: false },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: result, success: true }, { status: 201 });
  } catch (error) {
    console.error("[chat/send]", error);
    return NextResponse.json(
      { error: "Failed to send message", success: false },
      { status: 500 },
    );
  }
}

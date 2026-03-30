/*
  GET /api/chat/channels?locationId=xxx
  Returns all channels for a location
  with last message and unread count
*/

import { NextRequest, NextResponse } from "next/server";
import { getChannels } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }

    const channels = await getChannels(locationId);

    return NextResponse.json({
      channels,
    });
  } catch (error) {
    console.error("[chat/channels]", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 },
    );
  }
}

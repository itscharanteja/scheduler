/*
  GET    /api/chat/members?channelId=xxx
  POST   /api/chat/members  { channelId, employeeId, addedBy }
  DELETE /api/chat/members  { channelId, employeeId }
*/

import { NextRequest, NextResponse } from "next/server";
import { getChannelMembers, addChannelMember, removeChannelMember } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }
    const members = await getChannelMembers(channelId);
    return NextResponse.json({ members, channelId });
  } catch (error) {
    console.error("[chat/members GET]", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { channelId, employeeId, addedBy } = body as {
      channelId: string;
      employeeId: string;
      addedBy?: string;
    };

    if (!channelId || !employeeId) {
      return NextResponse.json({ error: "channelId and employeeId are required" }, { status: 400 });
    }

    await addChannelMember(channelId, employeeId, addedBy);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[chat/members POST]", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { channelId, employeeId } = body as {
      channelId: string;
      employeeId: string;
    };

    if (!channelId || !employeeId) {
      return NextResponse.json({ error: "channelId and employeeId are required" }, { status: 400 });
    }

    await removeChannelMember(channelId, employeeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat/members DELETE]", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}

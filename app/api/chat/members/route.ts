/*
  GET    /api/chat/members?channelId=xxx       — list members (any authenticated user)
  POST   /api/chat/members  { channelId, employeeId }   — add member (admin+)
  DELETE /api/chat/members  { channelId, employeeId }   — remove member (admin+)

  addedBy is derived from the session — not trusted from the body.
*/

import { NextRequest, NextResponse } from "next/server";
import { getChannelMembers, addChannelMember, removeChannelMember } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();

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
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const body = await request.json();
    const { channelId, employeeId } = body as { channelId: string; employeeId: string };

    if (!channelId || !employeeId) {
      return NextResponse.json(
        { error: "channelId and employeeId are required" },
        { status: 400 },
      );
    }

    await addChannelMember(channelId, employeeId, caller.employeeId ?? undefined);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[chat/members POST]", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const body = await request.json();
    const { channelId, employeeId } = body as { channelId: string; employeeId: string };

    if (!channelId || !employeeId) {
      return NextResponse.json(
        { error: "channelId and employeeId are required" },
        { status: 400 },
      );
    }

    await removeChannelMember(channelId, employeeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat/members DELETE]", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}

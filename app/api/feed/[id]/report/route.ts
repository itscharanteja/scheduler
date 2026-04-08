/*
  POST /api/feed/[id]/report
       Report a post. Body: { reason }
       One report per user per post (unique constraint).
*/

import { NextRequest, NextResponse } from "next/server";
import { getCallerInfo, makeAdminClient } from "../../_helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reason = body.reason?.trim() ?? "";
  const db = makeAdminClient();

  // Check if already reported by this user
  const { data: existing } = await db
    .from("feed_reports")
    .select("id")
    .eq("post_id", postId)
    .eq("reporter_id", caller.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You have already reported this post" }, { status: 409 });
  }

  const { error } = await db
    .from("feed_reports")
    .insert({ post_id: postId, reporter_id: caller.id, reason });

  if (error) {
    console.error("[feed report POST]", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

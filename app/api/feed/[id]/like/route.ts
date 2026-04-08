/*
  POST /api/feed/[id]/like
       Toggle like on a post. Returns { liked: boolean, likeCount: number }.
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
  const db = makeAdminClient();

  // Check if already liked
  const { data: existing } = await db
    .from("feed_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", caller.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    // Unlike
    await db.from("feed_likes").delete().eq("post_id", postId).eq("user_id", caller.id);
    liked = false;
  } else {
    // Like
    await db.from("feed_likes").insert({ post_id: postId, user_id: caller.id });
    liked = true;
  }

  // Get updated count
  const { count } = await db
    .from("feed_likes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  return NextResponse.json({ liked, likeCount: count ?? 0 });
}

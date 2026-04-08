/*
  DELETE /api/feed/[id]
         Soft-delete a post. Owner can delete their own; admin/super_admin can delete any.
*/

import { NextRequest, NextResponse } from "next/server";
import { getCallerInfo, makeAdminClient, isAdminRole } from "../_helpers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = makeAdminClient();

  // Fetch the post to check ownership
  const { data: post, error: fetchError } = await db
    .from("feed_posts")
    .select("id, author_id, is_deleted")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const row = post as { id: string; author_id: string; is_deleted: boolean };

  if (row.is_deleted) {
    return NextResponse.json({ error: "Post already deleted" }, { status: 410 });
  }

  if (row.author_id !== caller.id && !isAdminRole(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db
    .from("feed_posts")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) {
    console.error("[feed DELETE]", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/*
  GET  /api/feed/[id]/comments
       Fetch comments for a post.

  POST /api/feed/[id]/comments
       Add a comment. Body: { content }
*/

import { NextRequest, NextResponse } from "next/server";
import { getCallerInfo, makeAdminClient, resolveDisplayName } from "../../_helpers";
import type { FeedComment } from "@/lib/types";

type DbCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
  user_profiles: { full_name: string | null; employees: { name: string } | null } | null;
};

function mapComment(row: DbCommentRow): FeedComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: resolveDisplayName(row.user_profiles),
    content: row.content,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const db = makeAdminClient();

  const { data, error } = await db
    .from("feed_comments")
    .select("*, user_profiles!feed_comments_author_id_fkey(full_name, employees(name))")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[feed comments GET]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const comments = (data ?? []).map((row) => mapComment(row as DbCommentRow));
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const db = makeAdminClient();
  const { data, error } = await db
    .from("feed_comments")
    .insert({ post_id: postId, author_id: caller.id, content })
    .select("*, user_profiles!feed_comments_author_id_fkey(full_name, employees(name))")
    .single();

  if (error || !data) {
    console.error("[feed comments POST]", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  return NextResponse.json({ comment: mapComment(data as DbCommentRow) }, { status: 201 });
}

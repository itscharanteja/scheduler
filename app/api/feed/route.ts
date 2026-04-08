/*
  GET  /api/feed?offset=0&limit=20
       Returns paginated feed posts with like/comment/repost counts and likedByMe/repostedByMe flags.

  POST /api/feed
       Create a new post.
       Body: { content, imageUrl?, linkUrl?, linkTitle?, repostOfId? }
*/

import { NextRequest, NextResponse } from "next/server";
import { getCallerInfo, makeAdminClient, mapPost, type MappedPost } from "./_helpers";
import type { FeedPost } from "@/lib/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const db = makeAdminClient();

  // Fetch posts with author
  const { data: rows, error } = await db
    .from("feed_posts")
    .select("*, user_profiles!feed_posts_author_id_fkey(full_name, employees(name))")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[feed GET]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const posts = (rows ?? []).map(mapPost);
  const postIds = posts.map((p) => p.id);

  if (postIds.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  // Fetch all likes for these posts
  const { data: likes } = await db
    .from("feed_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  // Fetch comment counts
  const { data: comments } = await db
    .from("feed_comments")
    .select("post_id")
    .in("post_id", postIds)
    .eq("is_deleted", false);

  // Fetch repost counts
  const repostOfIds = postIds;
  const { data: reposts } = await db
    .from("feed_posts")
    .select("repost_of")
    .in("repost_of", repostOfIds)
    .eq("is_deleted", false);

  // Fetch original posts for reposts
  const repostOfPostIds = posts
    .filter((p) => p.repostOfId)
    .map((p) => p.repostOfId as string);

  let originals: MappedPost[] = [];
  if (repostOfPostIds.length > 0) {
    const { data: origRows } = await db
      .from("feed_posts")
      .select("*, user_profiles!feed_posts_author_id_fkey(full_name, employees(name))")
      .in("id", repostOfPostIds);
    originals = (origRows ?? []).map(mapPost);
  }

  // Build lookup maps
  const likesByPost = new Map<string, string[]>();
  for (const like of likes ?? []) {
    const l = like as { post_id: string; user_id: string };
    const existing = likesByPost.get(l.post_id) ?? [];
    existing.push(l.user_id);
    likesByPost.set(l.post_id, existing);
  }

  const commentCountByPost = new Map<string, number>();
  for (const c of comments ?? []) {
    const row = c as { post_id: string };
    commentCountByPost.set(row.post_id, (commentCountByPost.get(row.post_id) ?? 0) + 1);
  }

  const repostCountByPost = new Map<string, number>();
  for (const r of reposts ?? []) {
    const row = r as { repost_of: string };
    if (row.repost_of) {
      repostCountByPost.set(row.repost_of, (repostCountByPost.get(row.repost_of) ?? 0) + 1);
    }
  }

  const originalsById = new Map(originals.map((o) => [o.id, o]));

  const result: FeedPost[] = posts.map((post) => {
    const likedUsers = likesByPost.get(post.id) ?? [];
    const original = post.repostOfId ? originalsById.get(post.repostOfId) : null;

    let repostOf: FeedPost | null = null;
    if (original) {
      repostOf = {
        id: original.id,
        authorId: original.authorId,
        authorName: original.authorName,
        content: original.content,
        imageUrl: original.imageUrl,
        linkUrl: original.linkUrl,
        linkTitle: original.linkTitle,
        repostOf: null,
        likeCount: (likesByPost.get(original.id) ?? []).length,
        commentCount: commentCountByPost.get(original.id) ?? 0,
        repostCount: repostCountByPost.get(original.id) ?? 0,
        likedByMe: (likesByPost.get(original.id) ?? []).includes(caller.id),
        repostedByMe: false,
        isDeleted: original.isDeleted,
        createdAt: original.createdAt,
      };
    }

    return {
      id: post.id,
      authorId: post.authorId,
      authorName: post.authorName,
      content: post.content,
      imageUrl: post.imageUrl,
      linkUrl: post.linkUrl,
      linkTitle: post.linkTitle,
      repostOf,
      likeCount: likedUsers.length,
      commentCount: commentCountByPost.get(post.id) ?? 0,
      repostCount: repostCountByPost.get(post.id) ?? 0,
      likedByMe: likedUsers.includes(caller.id),
      repostedByMe: false,
      isDeleted: post.isDeleted,
      createdAt: post.createdAt,
    };
  });

  return NextResponse.json({ posts: result });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: string; imageUrl?: string; linkUrl?: string; linkTitle?: string; repostOfId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content = "", imageUrl, linkUrl, linkTitle, repostOfId } = body;

  if (!content.trim() && !repostOfId) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const db = makeAdminClient();
  const { data, error } = await db
    .from("feed_posts")
    .insert({
      author_id: caller.id,
      content: content.trim(),
      image_url: imageUrl?.trim() || null,
      link_url: linkUrl?.trim() || null,
      link_title: linkTitle?.trim() || null,
      repost_of: repostOfId || null,
    })
    .select("*, user_profiles!feed_posts_author_id_fkey(full_name, employees(name))")
    .single();

  if (error || !data) {
    console.error("[feed POST]", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }

  const post = mapPost(data as Parameters<typeof mapPost>[0]);

  const result: FeedPost = {
    id: post.id,
    authorId: post.authorId,
    authorName: post.authorName,
    content: post.content,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    linkTitle: post.linkTitle,
    repostOf: null,
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    likedByMe: false,
    repostedByMe: false,
    isDeleted: false,
    createdAt: post.createdAt,
  };

  return NextResponse.json({ post: result }, { status: 201 });
}

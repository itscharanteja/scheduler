"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Flag,
  Heart,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { FeedComment, FeedPost } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  canAdmin,
  onDeleted,
}: {
  post: FeedPost;
  currentUserId: string;
  canAdmin: boolean;
  onDeleted: (id: string) => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [repostText, setRepostText] = useState("");
  const [reposting, setReposting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwn = post.authorId === currentUserId;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleLike() {
    const res = await fetch(`/api/feed/${post.id}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    }
  }

  async function loadComments() {
    if (commentsOpen) { setCommentsOpen(false); return; }
    setCommentsLoading(true);
    setCommentsOpen(true);
    try {
      const res = await fetch(`/api/feed/${post.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitComment() {
    if (!commentDraft.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/feed/${post.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: commentDraft.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setCommentCount((n) => n + 1);
        setCommentDraft("");
      }
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleRepost() {
    setReposting(true);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: repostText, repostOfId: post.id }),
      });
      if (res.ok) {
        toast.success("Reposted");
        setRepostOpen(false);
        setRepostText("");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to repost");
      }
    } finally {
      setReposting(false);
    }
  }

  async function handleReport() {
    setReporting(true);
    try {
      const res = await fetch(`/api/feed/${post.id}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reportReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Report submitted");
        setReportOpen(false);
        setReportReason("");
      } else {
        toast.error(data.error ?? "Failed to submit report");
      }
    } finally {
      setReporting(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/feed/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Post removed");
      onDeleted(post.id);
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Failed to delete");
    }
    setMenuOpen(false);
  }

  return (
    <div className="app-panel p-4">
      {/* Repost indicator */}
      {post.repostOf && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Repeat2 className="h-3.5 w-3.5" />
          <span>{post.authorName} reposted</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {initials(post.authorName)}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">{post.authorName}</div>
            <div className="text-xs text-slate-500">{timeAgo(post.createdAt)}</div>
          </div>
        </div>

        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Flag className="h-3.5 w-3.5" />
                Report post
              </button>
              {(isOwn || canAdmin) && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <p className="mt-3 text-sm text-slate-800 whitespace-pre-wrap">{post.content}</p>
      )}

      {/* Image */}
      {post.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt="Post image"
            className="max-h-80 w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Link */}
      {post.linkUrl && (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-blue-600 hover:bg-slate-100"
        >
          <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{post.linkTitle || post.linkUrl}</span>
        </a>
      )}

      {/* Quoted repost (original post) */}
      {post.repostOf && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold">
              {initials(post.repostOf.authorName)}
            </div>
            {post.repostOf.authorName}
            <span className="font-normal text-slate-500">· {timeAgo(post.repostOf.createdAt)}</span>
          </div>
          {post.repostOf.content && (
            <p className="mt-1.5 text-sm text-slate-700">{post.repostOf.content}</p>
          )}
          {post.repostOf.imageUrl && (
            <div className="mt-2 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.repostOf.imageUrl}
                alt="Original post image"
                className="max-h-40 w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => void toggleLike()}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${liked ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          type="button"
          onClick={() => void loadComments()}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${commentsOpen ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>

        <button
          type="button"
          onClick={() => setRepostOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100"
        >
          <Repeat2 className="h-3.5 w-3.5" />
          {post.repostCount > 0 && <span>{post.repostCount}</span>}
        </button>
      </div>

      {/* Comments section */}
      {commentsOpen && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
          {commentsLoading ? (
            <div className="text-xs text-slate-500">Loading comments…</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-slate-500">No comments yet.</div>
          ) : (
            <div className="space-y-2.5">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">
                    {initials(c.authorName)}
                  </div>
                  <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-900">{c.authorName}</div>
                    <div className="mt-0.5 text-xs text-slate-700">{c.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment compose */}
          <div className="flex gap-2">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment…"
              rows={1}
              className="filter-input flex-1 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => void submitComment()}
              disabled={submittingComment || !commentDraft.trim()}
            >
              Post
            </Button>
          </div>
        </div>
      )}

      {/* Repost dialog */}
      <Dialog open={repostOpen} onOpenChange={setRepostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repost</DialogTitle>
            <DialogDescription>Add an optional comment to your repost.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{post.authorName}: </span>
            {post.content.slice(0, 160)}{post.content.length > 160 ? "…" : ""}
          </div>
          <textarea
            value={repostText}
            onChange={(e) => setRepostText(e.target.value)}
            placeholder="Add a comment… (optional)"
            rows={3}
            className="filter-input w-full resize-none text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepostOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleRepost()} disabled={reposting}>
              {reposting ? "Reposting…" : "Repost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report post</DialogTitle>
            <DialogDescription>Let us know why this post is inappropriate. Admins will review it.</DialogDescription>
          </DialogHeader>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason for reporting… (optional)"
            rows={3}
            className="filter-input w-full resize-none text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleReport()} disabled={reporting}>
              {reporting ? "Submitting…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ComposeBox ───────────────────────────────────────────────────────────────

function ComposeBox({ authorName, onPosted }: { authorName: string; onPosted: (post: FeedPost) => void }) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          imageUrl: imageUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          linkTitle: linkTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onPosted(data.post);
        setContent("");
        setImageUrl("");
        setLinkUrl("");
        setLinkTitle("");
        setShowExtras(false);
      } else {
        toast.error(data.error ?? "Failed to post");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-panel p-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {initials(authorName)}
        </div>
        <div className="flex-1 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className="filter-input w-full resize-none text-sm"
          />

          {showExtras && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <Input
                  placeholder="Image URL (https://…)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <Input
                  placeholder="Link URL (https://…)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="Link title (optional)"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowExtras((s) => !s)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${showExtras ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setShowExtras((s) => !s)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${showExtras ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Link
              </button>
            </div>
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitting || !content.trim()}
            >
              {submitting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user, hasRole } = useAuth();
  const { lang } = useLanguage();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const canAdmin = hasRole("admin", "super_admin");

  const authorName = user?.name ?? "You";
  const currentUserId = user?.id ?? "";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/feed?offset=0&limit=20");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setPosts(data.posts ?? []);
        setHasMore((data.posts ?? []).length === 20);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?offset=${posts.length}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        const newPosts: FeedPost[] = data.posts ?? [];
        setPosts((prev) => [...prev, ...newPosts]);
        setHasMore(newPosts.length === 20);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePosted(post: FeedPost) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">
            {lang === "sv" ? "Teamflöde" : "Team Feed"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {lang === "sv" ? "Dela uppdateringar med ditt team." : "Share updates with your team."}
          </p>
        </div>
        {canAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link href="/feed/reports">
              <ShieldAlert className="h-4 w-4" />
              Reports
            </Link>
          </Button>
        )}
      </div>

      {/* Compose */}
      <ComposeBox authorName={authorName} onPosted={handlePosted} />

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="app-panel h-36 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="app-panel px-5 py-12 text-center text-sm text-slate-500">
          {lang === "sv" ? "Inga inlägg ännu. Var den första att posta!" : "No posts yet. Be the first to post!"}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              canAdmin={canAdmin}
              onDeleted={handleDeleted}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

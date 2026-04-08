/*
  GET   /api/feed/reports
        Admin/super_admin: list pending reports.

  PATCH /api/feed/reports
        Admin/super_admin: take action on a report.
        Body: { reportId, action: "remove_post" | "dismiss" }
*/

import { NextRequest, NextResponse } from "next/server";
import { getCallerInfo, makeAdminClient, isAdminRole, resolveDisplayName } from "../_helpers";
import type { FeedReport } from "@/lib/types";

type DbReportRow = {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter: { full_name: string | null; employees: { name: string } | null } | null;
  feed_posts: {
    content: string;
    is_deleted: boolean;
    user_profiles: { full_name: string | null; employees: { name: string } | null } | null;
  } | null;
};

function mapReport(row: DbReportRow): FeedReport {
  return {
    id: row.id,
    postId: row.post_id,
    reporterId: row.reporter_id,
    reporterName: resolveDisplayName(row.reporter),
    reason: row.reason,
    status: row.status as FeedReport["status"],
    createdAt: row.created_at,
    postContent: row.feed_posts?.content ?? "",
    postAuthorName: resolveDisplayName(row.feed_posts?.user_profiles ?? null),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(caller.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = makeAdminClient();
  const { data, error } = await db
    .from("feed_reports")
    .select(`
      *,
      reporter:user_profiles!feed_reports_reporter_id_fkey(full_name, employees(name)),
      feed_posts(content, is_deleted, user_profiles!feed_posts_author_id_fkey(full_name, employees(name)))
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[feed reports GET]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const reports = (data ?? []).map((row) => mapReport(row as unknown as DbReportRow));
  return NextResponse.json({ reports });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerInfo(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(caller.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { reportId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reportId, action } = body;
  if (!reportId || !action) {
    return NextResponse.json({ error: "reportId and action are required" }, { status: 400 });
  }
  if (!["remove_post", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const db = makeAdminClient();

  if (action === "remove_post") {
    // Fetch the report to get the post_id
    const { data: report } = await db
      .from("feed_reports")
      .select("post_id")
      .eq("id", reportId)
      .single();

    if (report) {
      const row = report as { post_id: string };
      // Soft-delete the post
      await db.from("feed_posts").update({ is_deleted: true }).eq("id", row.post_id);
      // Mark all reports for this post as reviewed
      await db
        .from("feed_reports")
        .update({ status: "reviewed", reviewed_by: caller.id, reviewed_at: new Date().toISOString() })
        .eq("post_id", row.post_id);
    }
  } else {
    // dismiss — just update this report
    await db
      .from("feed_reports")
      .update({ status: "dismissed", reviewed_by: caller.id, reviewed_at: new Date().toISOString() })
      .eq("id", reportId);
  }

  return NextResponse.json({ success: true });
}

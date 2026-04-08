"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { FeedReport } from "@/lib/types";

type FilterStatus = "pending" | "reviewed" | "dismissed" | "all";

export default function FeedReportsPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<FeedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !hasRole("admin", "super_admin")) {
      router.replace("/feed");
    }
  }, [authLoading, hasRole, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/feed/reports");
        if (res.ok) {
          const data = await res.json();
          if (active) setReports(data.reports ?? []);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function takeAction(reportId: string, action: "remove_post" | "dismiss") {
    setActing(reportId);
    try {
      const res = await fetch("/api/feed/reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === "remove_post" ? "Post removed" : "Report dismissed");
        setReports((prev) =>
          prev.map((r) => {
            if (action === "remove_post" && r.postId === reports.find((x) => x.id === reportId)?.postId) {
              return { ...r, status: "reviewed" };
            }
            if (r.id === reportId) return { ...r, status: "dismissed" };
            return r;
          })
        );
      } else {
        toast.error(data.error ?? "Action failed");
      }
    } finally {
      setActing(null);
    }
  }

  const filtered = reports.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  const statusClass = (status: string) => {
    if (status === "pending") return "status-warning";
    if (status === "reviewed") return "status-success";
    return "status-neutral";
  };

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feed Reports</h1>
          <p className="page-subtitle">Review and moderate reported posts.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/feed">
            <ArrowLeft className="h-4 w-4" />
            Back to feed
          </Link>
        </Button>
      </div>

      <div className="app-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="toolbar-row">
            {(["pending", "reviewed", "dismissed", "all"] as FilterStatus[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === "pending" && pendingCount > 0 ? `Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-5 list-block">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Loading reports…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No reports in this category.</div>
          ) : (
            filtered.map((report) => (
              <div key={report.id} className="list-row items-start">
                <div className="list-row-main min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`status-chip ${statusClass(report.status)}`}>{report.status}</span>
                    <span className="list-row-title truncate">
                      Post by <strong>{report.postAuthorName}</strong>
                    </span>
                  </div>
                  {report.postContent && (
                    <div className="mt-1 list-row-copy line-clamp-2">
                      &ldquo;{report.postContent}&rdquo;
                    </div>
                  )}
                  <div className="mt-1 text-xs text-slate-500">
                    Reported by <strong>{report.reporterName}</strong>
                    {report.reason ? ` — "${report.reason}"` : ""}
                    {" · "}{new Date(report.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {report.status === "pending" && (
                  <div className="flex flex-shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => void takeAction(report.id, "remove_post")}
                      disabled={acting === report.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove post
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void takeAction(report.id, "dismiss")}
                      disabled={acting === report.id}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

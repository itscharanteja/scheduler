/*
  GET /api/shift-logs/summary
  ?locationId=xxx
  Returns a summary for the dashboard:
  - total logs last 7 days
  - flagged count last 7 days
  - most common issue keywords
  - last log entry
*/

import { NextRequest, NextResponse } from "next/server";
import type { ShiftLog } from "@/lib/types";
import { supabaseClient } from "@/lib/supabase";
import { subDays } from "date-fns";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json(
        { error: "Supabase client is not configured" },
        { status: 500 },
      );
    }

    const sevenDaysAgo = subDays(new Date(), 7);
    const dateString = sevenDaysAgo.toISOString().split("T")[0];

    const { data, error } = await supabaseClient
      .from("shift_logs")
      .select("*")
      .eq("location_id", locationId)
      .gte("date", dateString)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data || []) as Array<{
      id: string;
      location_id: string;
      shift_leader_id: string;
      date: string;
      shift_type: string;
      notes: string;
      issues_flagged: boolean;
      tasks_completed: string;
      tasks_pending: string;
      created_at: string;
    }>;

    const totalLogs = rows.length;
    const flaggedCount = rows.filter((r) => r.issues_flagged).length;

    // Check if any log has pending tasks
    const hasPendingTasks = rows.some((r) => {
      try {
        const pending = JSON.parse(r.tasks_pending || "[]");
        return Array.isArray(pending) && pending.length > 0;
      } catch {
        return false;
      }
    });

    // Get last log with shift leader name
    let lastLog: ShiftLog | null = null;

    if (rows.length > 0) {
      const lastRow = rows[0];

      // Fetch shift leader name
      const { data: employee } = await supabaseClient
        .from("employees")
        .select("name")
        .eq("id", lastRow.shift_leader_id)
        .single();

      lastLog = {
        id: lastRow.id,
        locationId: lastRow.location_id,
        shiftLeaderId: lastRow.shift_leader_id,
        shiftLeaderName: (employee as { name: string })?.name,
        date: lastRow.date,
        shiftType: lastRow.shift_type as ShiftLog["shiftType"],
        notes: lastRow.notes,
        issuesFlagged: lastRow.issues_flagged,
        tasksCompleted: JSON.parse(lastRow.tasks_completed || "[]"),
        tasksPending: JSON.parse(lastRow.tasks_pending || "[]"),
        createdAt: lastRow.created_at,
      };
    }

    return NextResponse.json({
      totalLogs,
      flaggedCount,
      hasPendingTasks,
      lastLog,
    });
  } catch (error) {
    console.error("[shift-logs/summary]", error);
    return NextResponse.json(
      { error: "Failed to fetch shift logs summary" },
      { status: 500 },
    );
  }
}

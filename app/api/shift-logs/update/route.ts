/*
  PATCH /api/shift-logs/update
  Updates notes, tasks, or flag status
  on an existing log entry
  Body: { id, notes?, tasksCompleted?,
          tasksPending?, issuesFlagged? }
*/

import { NextRequest, NextResponse } from "next/server";
import type { ShiftLog } from "@/lib/types";
import { supabaseClient } from "@/lib/supabase";

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      id,
      notes,
      tasksCompleted,
      tasksPending,
      issuesFlagged,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required", success: false },
        { status: 400 },
      );
    }

    if (!supabaseClient) {
      return NextResponse.json(
        { error: "Supabase client is not configured", success: false },
        { status: 500 },
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (tasksCompleted !== undefined) {
      updateData.tasks_completed = JSON.stringify(tasksCompleted);
    }

    if (tasksPending !== undefined) {
      updateData.tasks_pending = JSON.stringify(tasksPending);
    }

    if (issuesFlagged !== undefined) {
      updateData.issues_flagged = issuesFlagged;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: "At least one field must be provided for update",
          success: false,
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseClient
      .from("shift_logs")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    const row = data as {
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
    };

    // Fetch shift leader name
    const { data: employee } = await supabaseClient
      .from("employees")
      .select("name")
      .eq("id", row.shift_leader_id)
      .single();

    const log: ShiftLog = {
      id: row.id,
      locationId: row.location_id,
      shiftLeaderId: row.shift_leader_id,
      shiftLeaderName: (employee as { name: string })?.name,
      date: row.date,
      shiftType: row.shift_type as ShiftLog["shiftType"],
      notes: row.notes,
      issuesFlagged: row.issues_flagged,
      tasksCompleted: JSON.parse(row.tasks_completed || "[]"),
      tasksPending: JSON.parse(row.tasks_pending || "[]"),
      createdAt: row.created_at,
    };

    return NextResponse.json({
      log,
      success: true,
    });
  } catch (error) {
    console.error("[shift-logs/update]", error);
    return NextResponse.json(
      { error: "Failed to update shift log", success: false },
      { status: 500 },
    );
  }
}

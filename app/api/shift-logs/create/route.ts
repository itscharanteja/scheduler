/*
  POST /api/shift-logs/create
  Creates a new shift log entry. Requires user_lead or above.
  Body: { locationId, date, shiftType, notes, issuesFlagged, tasksCompleted, tasksPending }
  shiftLeaderId is derived from the session — not trusted from the body.
*/

import { NextRequest, NextResponse } from "next/server";
import type { CreateShiftLogPayload, ShiftType } from "@/lib/types";
import { createShiftLog, sendMessage, supabaseClient } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

const VALID_SHIFT_TYPES: ShiftType[] = ["morning", "lunch", "evening", "full"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  if (!caller.employeeId) {
    return NextResponse.json(
      { error: "Your account is not linked to an employee record", success: false },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { locationId, date, shiftType, notes, issuesFlagged, tasksCompleted, tasksPending } = body;

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required", success: false }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "date is required", success: false }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD", success: false }, { status: 400 });
    }
    if (!shiftType || !VALID_SHIFT_TYPES.includes(shiftType)) {
      return NextResponse.json(
        { error: "shiftType must be one of: morning, lunch, evening, full", success: false },
        { status: 400 },
      );
    }
    if (!notes || notes.trim() === "") {
      return NextResponse.json({ error: "notes is required and cannot be empty", success: false }, { status: 400 });
    }
    if (notes.length > 2000) {
      return NextResponse.json({ error: "notes must be 2000 characters or less", success: false }, { status: 400 });
    }
    if (typeof issuesFlagged !== "boolean") {
      return NextResponse.json({ error: "issuesFlagged must be a boolean", success: false }, { status: 400 });
    }
    if (!Array.isArray(tasksCompleted)) {
      return NextResponse.json({ error: "tasksCompleted must be an array", success: false }, { status: 400 });
    }
    if (!Array.isArray(tasksPending)) {
      return NextResponse.json({ error: "tasksPending must be an array", success: false }, { status: 400 });
    }

    const payload: CreateShiftLogPayload = {
      locationId,
      shiftLeaderId: caller.employeeId,
      date,
      shiftType,
      notes,
      issuesFlagged,
      tasksCompleted,
      tasksPending,
    };

    const log = await createShiftLog(payload);

    if (!log) {
      return NextResponse.json({ error: "Failed to create shift log", success: false }, { status: 500 });
    }

    // Send alert to managers channel if issues flagged
    let alertSent = false;
    if (issuesFlagged && supabaseClient) {
      try {
        const { data: channelData } = await supabaseClient
          .from("chat_channels")
          .select("id")
          .eq("slug", "managers")
          .eq("location_id", locationId)
          .limit(1)
          .single();

        if (channelData && "id" in channelData) {
          const alertMessage = `⚠️ Issue flagged in shift log for ${date} (${shiftType} shift). Notes: ${notes.slice(0, 100)}${notes.length > 100 ? "..." : ""}`;
          const result = await sendMessage({
            channelId: (channelData as { id: string }).id,
            senderId: caller.employeeId,
            message: alertMessage,
          });
          alertSent = result !== null;
        }
      } catch (alertError) {
        console.warn("[shift-logs/create] Failed to send manager alert:", alertError);
      }
    }

    return NextResponse.json({ log, success: true, alertSent }, { status: 201 });
  } catch (error) {
    console.error("[shift-logs/create]", error);
    return NextResponse.json({ error: "Failed to create shift log", success: false }, { status: 500 });
  }
}

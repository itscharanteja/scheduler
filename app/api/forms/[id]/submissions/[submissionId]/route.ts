import { NextRequest, NextResponse } from "next/server";
import {
  getCallerSession,
  hasRole,
  unauthorized,
  forbidden,
} from "@/lib/api-auth";
import { getFormSubmission } from "@/lib/supabase/forms";

type Params = { params: Promise<{ id: string; submissionId: string }> };

/**
 * GET /api/forms/[id]/submissions/[submissionId]
 * Returns a single submission with per-field responses.
 * Auth: user_lead, admin, super_admin.
 */
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  const { submissionId } = await params;
  try {
    const data = await getFormSubmission(submissionId);
    if (!data) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("[api/forms/[id]/submissions/[submissionId] GET]", error);
    return NextResponse.json({ error: "Failed to load submission." }, { status: 500 });
  }
}

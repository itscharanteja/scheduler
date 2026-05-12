import { NextRequest, NextResponse } from "next/server";
import {
  getCallerSession,
  hasRole,
  unauthorized,
  forbidden,
} from "@/lib/api-auth";
import { getFormSubmissions } from "@/lib/supabase/forms";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/forms/[id]/submissions
 * List submissions for a form.
 * Auth: user_lead, admin, super_admin.
 * Query params: dateFrom, dateTo, limit, offset
 */
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  const { id: formId } = await params;
  const search = req.nextUrl.searchParams;

  const opts = {
    dateFrom: search.get("dateFrom") ?? undefined,
    dateTo: search.get("dateTo") ?? undefined,
    limit: search.get("limit") ? Number(search.get("limit")) : 50,
    offset: search.get("offset") ? Number(search.get("offset")) : undefined,
  };

  try {
    const submissions = await getFormSubmissions(formId, opts);
    return NextResponse.json({ data: submissions }, { status: 200 });
  } catch (error) {
    console.error("[api/forms/[id]/submissions GET]", error);
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }
}

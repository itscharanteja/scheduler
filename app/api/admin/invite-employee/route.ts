/*
  GET  /api/admin/invite-employee?employeeId=<uuid>
       Check whether an employee already has an app account linked.
       Returns { hasAccount: boolean, profile?: { role, fullName } }

  POST /api/admin/invite-employee
       Invite an employee by email and assign an app role.
       Body: { employeeId, email, appRole, fullName }

  Requires the caller to be admin or super_admin.
  Uses SUPABASE_SERVICE_ROLE_KEY for admin operations (bypasses RLS).
*/

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CallerRole = "super_admin" | "admin" | "user_lead" | "user";

/** Create a Supabase client scoped to the current request's session (anon key + cookies). */
function makeUserClient(req: NextRequest) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // read-only in API routes — no-op
      },
    },
  });
}

/** Return the caller's role from user_profiles, or null if unauthenticated. */
async function getCallerRole(req: NextRequest): Promise<CallerRole | null> {
  const userClient = makeUserClient(req);
  const { data: { session } } = await userClient.auth.getSession();
  if (!session) return null;

  // Use service role to read user_profiles (bypasses RLS that only shows own row)
  if (!SERVICE_ROLE_KEY) return null;
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  return (data as { role: CallerRole } | null)?.role ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on this server." },
      { status: 503 },
    );
  }

  const callerRole = await getCallerRole(req);
  if (!callerRole || (callerRole !== "admin" && callerRole !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await adminClient
    .from("user_profiles")
    .select("id, role, full_name")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error) {
    console.error("[invite-employee GET]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ hasAccount: false });
  }

  return NextResponse.json({
    hasAccount: true,
    profile: {
      role: (data as { role: string; full_name: string | null }).role,
      fullName: (data as { role: string; full_name: string | null }).full_name ?? "",
    },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on this server." },
      { status: 503 },
    );
  }

  const callerRole = await getCallerRole(req);
  if (!callerRole || (callerRole !== "admin" && callerRole !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { employeeId?: string; email?: string; appRole?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { employeeId, email, appRole, fullName } = body;

  if (!employeeId || !email || !appRole || !fullName) {
    return NextResponse.json(
      { error: "employeeId, email, appRole, and fullName are required" },
      { status: 400 },
    );
  }

  // Role permission guard
  const allowedByAdmin = ["user_lead", "user"];
  const allowedBySuperAdmin = ["admin", "user_lead", "user"];
  const allowed = callerRole === "super_admin" ? allowedBySuperAdmin : allowedByAdmin;

  if (!allowed.includes(appRole)) {
    return NextResponse.json(
      { error: `Your role (${callerRole}) cannot assign the '${appRole}' role.` },
      { status: 403 },
    );
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Step 1: Invite the user — creates Auth row and fires handle_new_user() trigger
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { data: { full_name: fullName } },
  );

  if (inviteError || !inviteData?.user) {
    console.error("[invite-employee POST] invite error:", inviteError);
    return NextResponse.json(
      { error: inviteError?.message ?? "Failed to invite user" },
      { status: 500 },
    );
  }

  const newUserId = inviteData.user.id;

  // Step 2: Update the auto-created user_profiles row with the correct role + employee link
  // The trigger may need a moment — retry once if the row isn't there yet
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .update({
        role: appRole,
        employee_id: employeeId,
        full_name: fullName,
      })
      .eq("id", newUserId);

    if (!updateError) break;

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 300));
    } else {
      console.error("[invite-employee POST] update profile error:", updateError);
      // Non-fatal: user was invited, profile update failed — log and continue
    }
  }

  return NextResponse.json({ success: true, userId: newUserId }, { status: 201 });
}

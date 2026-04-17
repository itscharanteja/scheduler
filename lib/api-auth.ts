/**
 * lib/api-auth.ts
 *
 * Single source of truth for API route authentication.
 * Every route that needs to know who is calling should use getCallerSession().
 *
 * Replaces the ad-hoc patterns of reading requesterId / isSuperAdmin / senderId
 * from the request body, which are client-supplied and trivially spoofable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export type CallerRole = "super_admin" | "admin" | "user_lead" | "user";

export interface CallerSession {
  userId: string;
  role: CallerRole;
  /** Linked employee UUID from user_profiles.employee_id. Null if not linked. */
  employeeId: string | null;
}

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Service-role Supabase client — bypasses RLS.
 * Use only for reading user_profiles (which users cannot read for others).
 */
export function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

/**
 * Verify the session cookie in the request and return the caller's identity + role.
 *
 * Returns null when:
 * - Supabase is not configured (dev without env vars)
 * - No valid session cookie
 * - No user_profiles row found for the user
 */
export async function getCallerSession(req: NextRequest): Promise<CallerSession | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_KEY) return null;

  const userClient = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll() { /* read-only in route handlers */ },
    },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  const { data } = await serviceClient()
    .from("user_profiles")
    .select("role, employee_id")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  const row = data as { role: CallerRole; employee_id: string | null };
  return { userId: user.id, role: row.role, employeeId: row.employee_id };
}

/** 401 Unauthorised response. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
}

/** 403 Forbidden response. */
export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Returns true if the caller has any of the specified roles. */
export function hasRole(session: CallerSession, ...roles: CallerRole[]): boolean {
  return roles.includes(session.role);
}

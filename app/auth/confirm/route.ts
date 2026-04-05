/*
  GET /auth/confirm?code=xxx&next=/reset-password
  Exchanges the one-time code from Supabase recovery/invite emails for a
  session cookie, then redirects to `next` (defaults to /reset-password).
*/

import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cookieStore.set(name, value, options as any)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/confirm]", error.message);
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
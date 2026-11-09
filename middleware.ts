import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(req: NextRequest) {
  // Skip auth when Supabase is not configured (local dev without .env.local)
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  const isSignupPage = pathname === "/signup";
  const isWelcomePage = pathname === "/welcome";
  const isAuthFlow =
    pathname.startsWith("/auth/") || pathname === "/reset-password";
  // Kiosk page is intentionally public — it handles its own location scoping
  const isKiosk = pathname.startsWith("/punch");
  const isPublicStatic =
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.endsWith(".webmanifest") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico");
  const isPublicRoute =
    isLoginPage || isSignupPage || isWelcomePage || isAuthFlow || isKiosk || isPublicStatic;

  // Inspect request cookies for existing Supabase auth tokens
  const allCookies = req.cookies.getAll();
  const hasAuthToken = allCookies.some(
    (c) =>
      c.name.includes("-auth-token") ||
      (c.name.startsWith("sb-") && c.name.includes("token")) ||
      c.name === "sb-access-token"
  );

  // If unauthenticated and accessing a protected route, fast-fail redirect immediately without remote query
  if (!hasAuthToken && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If unauthenticated on a public route, allow immediately
  if (!hasAuthToken) {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: req.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.cookies.set(name, value, options as any),
        );
      },
    },
    global: {
      fetch: (url, opts) =>
        fetch(url, { ...opts, signal: AbortSignal.timeout(1500) }),
    },
  });

  // Query session with timeout guard. If remote Supabase is sleeping, fail open to client shell
  let session = null;
  try {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    session = currentSession;
  } catch (err) {
    console.warn(
      `[middleware] Supabase getSession timed out or failed on ${pathname}:`,
      err
    );
    // Request holds a session cookie: fail open to client shell where JWT claims are verified locally
    return res;
  }

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && (isLoginPage || isSignupPage)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  // Run on all routes except Next.js internals, API routes, and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|api/|images/).*)",
  ],
};

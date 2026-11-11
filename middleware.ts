import { NextRequest, NextResponse } from "next/server";
import { extractAccessToken, verifyAccessToken } from "@/lib/auth/jwt-verify";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;

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

  // Extract access token locally from request cookies with zero network overhead
  const token = extractAccessToken(req.cookies);

  // If no token exists
  if (!token) {
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Cryptographically verify token and expiration locally via Web Crypto (< 2ms)
  const { valid, needsRefresh } = await verifyAccessToken(token, jwtSecret);

  if (!valid) {
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Authenticated user attempting to visit login/signup -> redirect to dashboard
  if (isLoginPage || isSignupPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Valid session on protected or public route -> forward with 0 network calls
  const requestHeaders = new Headers(req.headers);
  if (needsRefresh) {
    requestHeaders.set("x-token-refresh-needed", "1");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Run on all routes except Next.js internals, API routes, and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|api/|images/).*)",
  ],
};

import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase/client";
import { serviceClient } from "@/lib/api-auth";

interface HealthCache {
  status: "ok" | "degraded" | "mock";
  timestamp: number;
  error?: string;
  httpStatus: number;
}

let serverHealthCache: HealthCache | null = null;
const CACHE_TTL_MS = 5000;

export async function GET(): Promise<NextResponse> {
  const now = Date.now();

  // Return cached result if within circuit breaker window
  if (serverHealthCache && now - serverHealthCache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        status: serverHealthCache.status,
        timestamp: serverHealthCache.timestamp,
        error: serverHealthCache.error,
        cached: true,
      },
      { status: serverHealthCache.httpStatus }
    );
  }

  // If Supabase is unconfigured (dev without env vars), return mock ok
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    serverHealthCache = {
      status: "mock",
      timestamp: now,
      httpStatus: 200,
    };
    return NextResponse.json({ status: "mock", timestamp: now }, { status: 200 });
  }

  try {
    const client = (() => {
      try {
        return serviceClient();
      } catch {
        return supabaseClient;
      }
    })();

    if (!client) {
      throw new Error("No available Supabase client");
    }

    const { error } = await client
      .from("locations")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));

    if (error) throw error;

    serverHealthCache = {
      status: "ok",
      timestamp: now,
      httpStatus: 200,
    };

    return NextResponse.json({ status: "ok", timestamp: now }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Health probe failed";
    console.warn("[api/health] Database health check failed:", message);

    serverHealthCache = {
      status: "degraded",
      timestamp: now,
      error: message,
      httpStatus: 503,
    };

    return NextResponse.json(
      { status: "degraded", error: message, timestamp: now },
      { status: 503 }
    );
  }
}

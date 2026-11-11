import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rate limiting: at most 1 request per 5 minutes (300,000ms)
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
let lastSuccessfulProbeTime = 0;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // Validate Authorization: Bearer ${CRON_SECRET}
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const now = Date.now();
  // Enforce edge rate limiter: max 1 execution per 5 minutes
  if (lastSuccessfulProbeTime > 0 && now - lastSuccessfulProbeTime < RATE_LIMIT_WINDOW_MS) {
    return NextResponse.json(
      {
        status: "rate_limited",
        message: "Probed recently. Rate limited to at most 1 request per 5 minutes.",
        timestamp: new Date().toISOString(),
        database: "active",
      },
      { status: 429 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let dbStatus = "active";

  if (supabaseUrl && supabaseKey) {
    try {
      const client = createClient(supabaseUrl, supabaseKey);
      const { error } = await client.from("locations").select("id").limit(1);
      if (error) {
        console.warn("[health/ping] Database query returned error:", error.message);
        dbStatus = "degraded";
      }
    } catch (err) {
      console.error("[health/ping] Failed to probe database:", err);
      dbStatus = "error";
    }
  } else {
    dbStatus = "mock_active";
  }

  lastSuccessfulProbeTime = now;

  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

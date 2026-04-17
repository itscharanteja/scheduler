/*
  WEATHER REFRESH API
  GET /api/weather/refresh?locationId=xxx
  Forces a fresh weather fetch regardless of cache
*/

import { NextRequest, NextResponse } from "next/server";
import { upsertWeatherForecast } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden, resolveLocationId } from "@/lib/api-auth";
import {
  fetchWeatherFromAPI,
  getMockWeather,
} from "@/lib/weather";

type RefreshResponse = {
  success: boolean;
  updatedAt: string;
  count: number;
  source?: "live" | "mock";
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const locationId = resolveLocationId(caller, request.nextUrl.searchParams.get("locationId"));

    if (!locationId) {
      return NextResponse.json(
        { error: "No location associated with your account." },
        { status: 403 },
      );
    }

    const updatedAt = new Date().toISOString();

    // Try to fetch fresh data
    try {
      const fresh = await fetchWeatherFromAPI();

      // Save to cache
      await upsertWeatherForecast(locationId, fresh);

      const response: RefreshResponse = {
        success: true,
        updatedAt,
        count: fresh.length,
      };

      return NextResponse.json(response);
    } catch (apiError) {
      console.warn(
        "[weather/refresh] API fetch failed, using mock data:",
        apiError,
      );

      // Fallback to mock data
      const mock = getMockWeather();
      await upsertWeatherForecast(locationId, mock);

      const response: RefreshResponse = {
        success: true,
        updatedAt,
        count: mock.length,
        source: "mock",
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("[weather/refresh] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to refresh weather" },
      { status: 500 },
    );
  }
}

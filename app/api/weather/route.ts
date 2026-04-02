/*
  WEATHER API
  GET /api/weather?locationId=xxx
  Returns 7-day forecast with staffing suggestions
  Source: "live" | "cache" | "mock"
*/

import { NextRequest, NextResponse } from "next/server";
import type { WeatherForecast, WeatherSuggestion } from "@/lib/types";
import {
  getCachedWeather,
  upsertWeatherForecast,
} from "@/lib/supabase";
import {
  fetchWeatherFromAPI,
  getMockWeather,
  shouldRefreshCache,
  getWeatherIcon,
} from "@/lib/weather";

type WeatherResponse = {
  source: "live" | "cache" | "mock";
  fetchedAt: string;
  forecasts: WeatherForecast[];
  suggestions: WeatherSuggestion[];
};

function extractStaffingDelta(staffingSuggestion: string): number {
  if (staffingSuggestion.includes("3 extra")) return 3;
  if (staffingSuggestion.includes("2 extra")) return 2;
  if (staffingSuggestion.includes("1 extra")) return 1;
  if (staffingSuggestion.includes("Reduce staffing by 2")) return -2;
  if (staffingSuggestion.includes("reducing 1")) return -1;
  return 0;
}

function getBaseStaff(day: string): number {
  if (day === "Saturday" || day === "Sunday") return 6;
  if (day === "Friday") return 5;
  return 4;
}

function mapToWeatherSuggestion(
  forecast: WeatherForecast,
): WeatherSuggestion {
  const delta = extractStaffingDelta(forecast.staffingSuggestion);
  const baseStaff = getBaseStaff(forecast.day);

  return {
    date: forecast.forecastDate,
    day: forecast.day,
    condition: forecast.condition,
    icon: getWeatherIcon(forecast.condition),
    staffingDelta: delta,
    staffingReason: forecast.staffingSuggestion,
    recommendedStaff: baseStaff + delta,
    inventoryAlerts: forecast.inventorySuggestion
      ? forecast.inventorySuggestion.split(". ").filter(Boolean)
      : [],
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId parameter is required" },
        { status: 400 },
      );
    }

    // Try to get cached weather
    const cached = await getCachedWeather(locationId);

    // Check if cache is fresh
    if (cached && cached.length >= 7) {
      const oldestForecast = cached[0];
      if (!shouldRefreshCache(oldestForecast.fetchedAt)) {
        const suggestions = cached.map(mapToWeatherSuggestion);

        const response: WeatherResponse = {
          source: "cache",
          fetchedAt: new Date().toISOString(),
          forecasts: cached,
          suggestions,
        };

        return NextResponse.json(response);
      }
    }

    // Try to fetch fresh data
    try {
      const fresh = await fetchWeatherFromAPI();

      // Save to cache
      await upsertWeatherForecast(locationId, fresh);

      // Map to full forecast objects with IDs
      const forecasts: WeatherForecast[] = fresh.map((f) => ({
        ...f,
        id: crypto.randomUUID(),
        locationId,
        fetchedAt: new Date().toISOString(),
      }));

      const suggestions = forecasts.map(mapToWeatherSuggestion);

      const response: WeatherResponse = {
        source: "live",
        fetchedAt: new Date().toISOString(),
        forecasts,
        suggestions,
      };

      return NextResponse.json(response);
    } catch (apiError) {
      console.warn("[weather] API fetch failed, using mock data:", apiError);

      // Fallback to mock data
      const mock = getMockWeather();

      const forecasts: WeatherForecast[] = mock.map((f) => ({
        ...f,
        id: crypto.randomUUID(),
        locationId,
        fetchedAt: new Date().toISOString(),
      }));

      const suggestions = forecasts.map(mapToWeatherSuggestion);

      const response: WeatherResponse = {
        source: "mock",
        fetchedAt: new Date().toISOString(),
        forecasts,
        suggestions,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("[weather] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 },
    );
  }
}

import { supabaseClient, requireClient } from "./client";
import type { WeatherForecast } from "@/lib/types";

export type DbWeatherRow = {
  id: string;
  location_id: string;
  forecast_date: string;
  temperature_high: number;
  temperature_low: number;
  condition: string;
  rain_probability: number;
  wind_speed: number;
  uv_index: number;
  staffing_suggestion: string;
  inventory_suggestion: string | null;
  fetched_at: string;
};

export function mapDbWeatherRow(row: DbWeatherRow): WeatherForecast {
  const dateStr = row.forecast_date;
  const date = new Date(dateStr + "T12:00:00Z");
  const day = !isNaN(date.getTime())
    ? date.toLocaleDateString("en-SE", { weekday: "long" })
    : "";

  return {
    id: row.id,
    locationId: row.location_id,
    forecastDate: dateStr,
    day,
    temperatureHigh: Number(row.temperature_high),
    temperatureLow: Number(row.temperature_low),
    condition: row.condition as WeatherForecast["condition"],
    rainProbability: Number(row.rain_probability ?? 0),
    windSpeed: Number(row.wind_speed ?? 0),
    uvIndex: Number(row.uv_index ?? 0),
    staffingSuggestion: row.staffing_suggestion ?? "",
    inventorySuggestion: row.inventory_suggestion ?? "",
    fetchedAt: row.fetched_at,
  };
}

export async function getCachedWeather(locationId: string): Promise<WeatherForecast[] | null> {
  try {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from("weather_cache")
      .select("*")
      .eq("location_id", locationId)
      .order("forecast_date", { ascending: true });
    if (error) throw error;
    if (!data) return null;
    return (data as DbWeatherRow[]).map(mapDbWeatherRow);
  } catch (error) {
    console.error("[supabase:getCachedWeather]", error);
    return null;
  }
}

export async function upsertWeatherForecast(
  locationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forecasts: any[]
): Promise<void> {
  try {
    const client = requireClient();
    const data = forecasts.map((forecast) => ({
      location_id: locationId,
      forecast_date: forecast.forecastDate || forecast.forecast_date,
      temperature_high: forecast.temperatureHigh ?? forecast.temperature_high,
      temperature_low: forecast.temperatureLow ?? forecast.temperature_low,
      condition: forecast.condition,
      rain_probability: forecast.rainProbability ?? forecast.rain_probability ?? 0,
      wind_speed: forecast.windSpeed ?? forecast.wind_speed ?? 0,
      uv_index: forecast.uvIndex ?? forecast.uv_index ?? 0,
      staffing_suggestion: forecast.staffingSuggestion ?? forecast.staffing_suggestion ?? "",
      inventory_suggestion: forecast.inventorySuggestion ?? forecast.inventory_suggestion ?? "",
      fetched_at: new Date().toISOString(),
    }));
    const { error } = await client
      .from("weather_cache")
      .upsert(data, { onConflict: "location_id,forecast_date" });
    if (error) throw error;
  } catch (error) {
    console.error("[supabase:upsertWeatherForecast]", error);
    throw error;
  }
}

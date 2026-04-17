import { supabaseClient, requireClient } from "./client";

export async function getCachedWeather(locationId: string): Promise<any[] | null> {
  try {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from("weather_cache")
      .select("*")
      .eq("location_id", locationId)
      .order("forecast_date", { ascending: true });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[supabase:getCachedWeather]", error);
    return null;
  }
}

export async function upsertWeatherForecast(locationId: string, forecasts: any[]): Promise<void> {
  try {
    const client = requireClient();
    const data = forecasts.map((forecast) => ({
      location_id: locationId,
      forecast_date: forecast.forecastDate,
      day: forecast.day,
      temperature_high: forecast.temperatureHigh,
      temperature_low: forecast.temperatureLow,
      condition: forecast.condition,
      rain_probability: forecast.rainProbability,
      wind_speed: forecast.windSpeed,
      uv_index: forecast.uvIndex,
      staffing_suggestion: forecast.staffingSuggestion,
      inventory_suggestion: forecast.inventorySuggestion,
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

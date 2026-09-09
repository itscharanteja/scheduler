import type { WeatherForecast, WeatherCondition, WeatherSuggestion } from "./types";

const GOTHENBURG_LAT = 57.7089;
const GOTHENBURG_LON = 11.9746;
const CACHE_HOURS = 3;
const API_KEY = process.env.OPENWEATHER_API_KEY;

// ─────────────────────────────────────────────────
// Weather API Integration
// ─────────────────────────────────────────────────

type OpenWeatherForecastEntry = {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    main: string;
  }>;
  wind?: {
    speed?: number;
  };
  pop?: number;
};

type OpenWeatherForecastResponse = {
  list: OpenWeatherForecastEntry[];
};

type OpenWeatherCurrentResponse = {
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    main: string;
  }>;
  wind?: {
    speed?: number;
  };
};

function normalizeCondition(condition: string): WeatherCondition {
  switch (condition) {
    case "Clear":
      return "Clear";
    case "Clouds":
      return "Clouds";
    case "Rain":
      return "Rain";
    case "Drizzle":
      return "Drizzle";
    case "Snow":
      return "Snow";
    case "Thunderstorm":
      return "Thunderstorm";
    default:
      return "Clouds";
  }
}

export async function fetchWeatherFromAPI(): Promise<
  Omit<WeatherForecast, "id" | "locationId" | "fetchedAt">[]
> {
  if (!API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is not set");
  }

  const forecastUrl = new URL("https://api.openweathermap.org/data/2.5/forecast");
  forecastUrl.searchParams.append("lat", GOTHENBURG_LAT.toString());
  forecastUrl.searchParams.append("lon", GOTHENBURG_LON.toString());
  forecastUrl.searchParams.append("appid", API_KEY);
  forecastUrl.searchParams.append("units", "metric");

  const currentWeatherUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
  currentWeatherUrl.searchParams.append("lat", GOTHENBURG_LAT.toString());
  currentWeatherUrl.searchParams.append("lon", GOTHENBURG_LON.toString());
  currentWeatherUrl.searchParams.append("appid", API_KEY);
  currentWeatherUrl.searchParams.append("units", "metric");

  const [forecastRes, currentRes] = await Promise.all([
    fetch(forecastUrl.toString()),
    fetch(currentWeatherUrl.toString()),
  ]);

  if (!forecastRes.ok) {
    throw new Error(
      `OpenWeather forecast API error: ${forecastRes.status} ${forecastRes.statusText}`,
    );
  }

  const forecastData = (await forecastRes.json()) as OpenWeatherForecastResponse;
  const currentData = currentRes.ok
    ? ((await currentRes.json()) as OpenWeatherCurrentResponse)
    : null;

  // Group 3-hourly entries by date (YYYY-MM-DD)
  const byDate = new Map<
    string,
    {
      temps: number[];
      conditions: string[];
      rainProbs: number[];
      windSpeeds: number[];
    }
  >();

  forecastData.list.forEach((entry) => {
    const dateStr = entry.dt_txt.split(" ")[0];
    const existing = byDate.get(dateStr) || {
      temps: [],
      conditions: [],
      rainProbs: [],
      windSpeeds: [],
    };

    existing.temps.push(entry.main.temp);
    existing.conditions.push(entry.weather[0]?.main ?? "Clouds");
    existing.rainProbs.push(entry.pop ?? 0);
    if (entry.wind?.speed != null) {
      existing.windSpeeds.push(entry.wind.speed);
    }

    byDate.set(dateStr, existing);
  });

  const dates = Array.from(byDate.keys()).sort();
  const todayStr = new Date().toISOString().split("T")[0];

  const forecasts: Omit<WeatherForecast, "id" | "locationId" | "fetchedAt">[] = [];

  dates.forEach((dateStr, index) => {
    const entry = byDate.get(dateStr);
    if (!entry) return;

    const isToday = index === 0 || dateStr === todayStr;

    // Find most frequent condition
    const conditionCounts = new Map<string, number>();
    entry.conditions.forEach((c) => {
      conditionCounts.set(c, (conditionCounts.get(c) || 0) + 1);
    });
    let mostFrequent = "Clouds";
    let maxCount = 0;
    conditionCounts.forEach((count, condition) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = condition;
      }
    });

    const liveCondition = isToday && currentData?.weather?.[0]?.main
      ? currentData.weather[0].main
      : undefined;
    const liveWind = isToday ? currentData?.wind?.speed : undefined;
    const liveTemp = isToday ? currentData?.main?.temp : undefined;

    const allTemps = liveTemp !== undefined ? [...entry.temps, liveTemp] : entry.temps;
    const maxTemp = Math.round(Math.max(...allTemps));
    const minTemp = Math.round(Math.min(...allTemps));
    const avgWind = entry.windSpeeds.length > 0
      ? entry.windSpeeds.reduce((a, b) => a + b, 0) / entry.windSpeeds.length
      : 3.5;
    const windSpeed = liveWind !== undefined ? liveWind : avgWind;

    const date = new Date(dateStr + "T12:00:00Z");

    forecasts.push({
      forecastDate: dateStr,
      day: date.toLocaleDateString("en-SE", { weekday: "long" }),
      temperatureHigh: maxTemp,
      temperatureLow: minTemp,
      condition: normalizeCondition(liveCondition || mostFrequent),
      rainProbability: Math.round(Math.max(...entry.rainProbs, 0) * 100),
      windSpeed: Math.round(windSpeed * 10) / 10,
      uvIndex: 0,
      staffingSuggestion: "",
      inventorySuggestion: "",
    });
  });

  // Project remaining days up to 7 if fewer days were returned
  while (forecasts.length < 7 && forecasts.length > 0) {
    const last = forecasts[forecasts.length - 1];
    const nextDate = new Date(last.forecastDate + "T12:00:00Z");
    nextDate.setDate(nextDate.getDate() + 1);
    const dateStr = nextDate.toISOString().split("T")[0];

    forecasts.push({
      forecastDate: dateStr,
      day: nextDate.toLocaleDateString("en-SE", { weekday: "long" }),
      temperatureHigh: last.temperatureHigh,
      temperatureLow: last.temperatureLow,
      condition: last.condition,
      rainProbability: Math.max(0, Math.round(last.rainProbability * 0.8)),
      windSpeed: last.windSpeed,
      uvIndex: 0,
      staffingSuggestion: "",
      inventorySuggestion: "",
    });
  }

  // Add suggestions
  return generateWeatherSuggestions(forecasts);
}

export function generateWeatherSuggestions(
  forecasts: Omit<
    WeatherForecast,
    "id" | "locationId" | "fetchedAt" | "staffingSuggestion" | "inventorySuggestion"
  >[],
): Omit<WeatherForecast, "id" | "locationId" | "fetchedAt">[] {
  return forecasts.map((forecast) => {
    // Generate staffing suggestion
    let staffingSuggestion = "";

    if (
      forecast.condition === "Thunderstorm" ||
      forecast.condition === "Snow"
    ) {
      staffingSuggestion =
        "Severe weather — significant drop in foot traffic. Reduce staffing by 2.";
    } else if (forecast.condition === "Rain" || forecast.rainProbability > 60) {
      staffingSuggestion =
        "Rainy day — lower foot traffic expected. Consider reducing 1 staff.";
    } else if (
      forecast.temperatureHigh > 22 &&
      forecast.condition === "Clear" &&
      (forecast.day === "Saturday" || forecast.day === "Sunday")
    ) {
      staffingSuggestion =
        "Hot sunny weekend — very busy day ahead. Add 3 extra staff.";
    } else if (
      forecast.condition === "Clear" &&
      (forecast.day === "Saturday" || forecast.day === "Sunday")
    ) {
      staffingSuggestion =
        "Sunny weekend — expect high foot traffic. Add 2 extra staff.";
    } else if (forecast.condition === "Clear" && forecast.temperatureHigh > 20) {
      staffingSuggestion =
        "Warm sunny day — slightly higher traffic. Add 1 extra staff.";
    } else if (forecast.condition === "Clear") {
      staffingSuggestion = "Clear day — normal staffing recommended.";
    } else {
      staffingSuggestion = "Normal conditions — standard staffing.";
    }

    // Generate inventory suggestion
    const inventorySuggestions: string[] = [];

    if (forecast.temperatureHigh > 22) {
      inventorySuggestions.push("Stock extra cold drinks.");
    }

    if (
      forecast.condition === "Clear" &&
      (forecast.day === "Saturday" || forecast.day === "Sunday")
    ) {
      inventorySuggestions.push(
        "Check beef patty and brioche bun levels before the weekend.",
      );
    }

    if (forecast.condition === "Rain" || forecast.rainProbability > 60) {
      inventorySuggestions.push(
        "Expect more delivery orders — check packaging stock.",
      );
    }

    const inventorySuggestion =
      inventorySuggestions.length > 0
        ? inventorySuggestions.join(" ")
        : "";

    return {
      ...forecast,
      staffingSuggestion,
      inventorySuggestion,
    };
  });
}

export function getWeatherIcon(condition: WeatherCondition): string {
  const icons: Record<WeatherCondition, string> = {
    Clear: "☀️",
    Clouds: "⛅",
    Rain: "🌧️",
    Drizzle: "🌦️",
    Snow: "❄️",
    Thunderstorm: "⛈️",
  };

  return icons[condition] || "🌤️";
}

export function shouldRefreshCache(
  fetchedAt: string | null | undefined,
): boolean {
  if (!fetchedAt) return true;

  const diffMs = Date.now() - new Date(fetchedAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > CACHE_HOURS;
}

export function getMockWeather(): Omit<
  WeatherForecast,
  "id" | "locationId" | "fetchedAt"
>[] {
  const mockData = [
    {
      condition: "Clear" as WeatherCondition,
      tempHigh: 21,
      tempLow: 14,
      rain: 5,
    },
    {
      condition: "Clouds" as WeatherCondition,
      tempHigh: 18,
      tempLow: 12,
      rain: 30,
    },
    {
      condition: "Rain" as WeatherCondition,
      tempHigh: 15,
      tempLow: 10,
      rain: 80,
    },
    {
      condition: "Clouds" as WeatherCondition,
      tempHigh: 17,
      tempLow: 11,
      rain: 35,
    },
    {
      condition: "Clear" as WeatherCondition,
      tempHigh: 22,
      tempLow: 15,
      rain: 5,
    },
    {
      condition: "Clear" as WeatherCondition,
      tempHigh: 25,
      tempLow: 16,
      rain: 5,
    },
    {
      condition: "Clear" as WeatherCondition,
      tempHigh: 23,
      tempLow: 14,
      rain: 10,
    },
  ];

  const forecasts = mockData.map((data, i) => {
    const date = new Date(Date.now() + i * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const dayName = date.toLocaleDateString("en-SE", { weekday: "long" });

    return {
      forecastDate: dateStr,
      day: dayName,
      temperatureHigh: data.tempHigh,
      temperatureLow: data.tempLow,
      condition: data.condition,
      rainProbability: data.rain,
      windSpeed: 3.5,
      uvIndex: 0,
      staffingSuggestion: "",
      inventorySuggestion: "",
    };
  });

  return generateWeatherSuggestions(forecasts);
}

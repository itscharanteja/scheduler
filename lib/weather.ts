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
  wind: {
    speed: number;
  };
  pop: number;
};

type OpenWeatherResponse = {
  list: OpenWeatherForecastEntry[];
};

export async function fetchWeatherFromAPI(): Promise<
  Omit<WeatherForecast, "id" | "locationId" | "fetchedAt">[]
> {
  if (!API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is not set");
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.append("lat", GOTHENBURG_LAT.toString());
  url.searchParams.append("lon", GOTHENBURG_LON.toString());
  url.searchParams.append("appid", API_KEY);
  url.searchParams.append("units", "metric");
  url.searchParams.append("cnt", "56");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `OpenWeather API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenWeatherResponse;

  // Group 3-hourly entries by date
  const byDate = new Map<
    string,
    {
      temps: number[];
      conditions: string[];
      rainProbs: number[];
      windSpeeds: number[];
    }
  >();

  data.list.forEach((entry) => {
    const date = entry.dt_txt.split(" ")[0]; // YYYY-MM-DD
    const existing = byDate.get(date) || {
      temps: [],
      conditions: [],
      rainProbs: [],
      windSpeeds: [],
    };

    existing.temps.push(entry.main.temp);
    existing.conditions.push(entry.weather[0].main);
    existing.rainProbs.push(entry.pop);
    existing.windSpeeds.push(entry.wind.speed);

    byDate.set(date, existing);
  });

  // Calculate daily forecasts
  const forecasts: Omit<WeatherForecast, "id" | "locationId" | "fetchedAt">[] =
    [];

  // Only get first 7 days
  const dates = Array.from(byDate.keys()).slice(0, 7);

  dates.forEach((dateStr) => {
    const entry = byDate.get(dateStr);
    if (!entry) return;

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

    const forecast: Omit<WeatherForecast, "id" | "locationId" | "fetchedAt"> =
      {
        forecastDate: dateStr,
        day: new Date(dateStr).toLocaleDateString("en-SE", {
          weekday: "long",
        }),
        temperatureHigh: Math.max(...entry.temps),
        temperatureLow: Math.min(...entry.temps),
        condition: mostFrequent as WeatherCondition,
        rainProbability: Math.round(Math.max(...entry.rainProbs) * 100),
        windSpeed: Math.round((entry.windSpeeds.reduce((a, b) => a + b) / entry.windSpeeds.length) * 10) / 10,
        uvIndex: 0,
        staffingSuggestion: "",
        inventorySuggestion: "",
      };

    forecasts.push(forecast);
  });

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

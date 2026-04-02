"use client";

import { Cloud, CloudDrizzle, CloudSun, Snowflake, Sun, Wind } from "lucide-react";
import { format } from "date-fns";
import type { WeatherForecastDay } from "@/lib/types";

function weatherIcon(condition: WeatherForecastDay["condition"]) {
  switch (condition) {
    case "sunny":
      return Sun;
    case "partly-cloudy":
      return CloudSun;
    case "cloudy":
      return Cloud;
    case "rain":
      return CloudDrizzle;
    case "windy":
      return Wind;
    case "snow":
      return Snowflake;
    default:
      return Sun;
  }
}

export function WeatherStrip({
  forecast,
}: {
  forecast: WeatherForecastDay[];
}) {
  return (
    <div className="glass-card overflow-hidden p-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Forecast</h3>
          <p className="text-xs text-slate-600">7-day operational outlook</p>
        </div>
        <div className="glass-chip px-3 py-1 text-[11px] text-slate-700">
          Weather-aware staffing
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {forecast.map((day) => {
          const Icon = weatherIcon(day.condition);
          return (
            <div
              key={day.date}
              className="glass-muted rounded-[20px] border border-white/70 px-3 py-3 transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  {format(new Date(`${day.date}T00:00:00`), "EEE")}
                </div>
                <Icon className="h-4 w-4 text-slate-700" />
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900">
                {day.tempHigh}°
              </div>
              <div className="text-xs text-slate-500">{day.tempLow}° low</div>
              <div className="mt-2 line-clamp-2 text-xs text-slate-700">
                {day.summary}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{day.precipitationChance}% rain</span>
                <span>{day.windKph} km/h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

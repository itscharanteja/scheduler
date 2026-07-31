-- ============================================================
-- 020: Weather cache
-- ============================================================
-- Backs lib/supabase/weather.ts (getCachedWeather / upsertWeatherForecast).
-- Table was referenced by the app but never created by a prior migration,
-- causing PostgREST schema-cache errors (PGRST204) on every weather write.

CREATE TABLE IF NOT EXISTS weather_cache (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date         date NOT NULL,
  day                   text NOT NULL,
  temperature_high      numeric(5,2) NOT NULL,
  temperature_low       numeric(5,2) NOT NULL,
  condition             text NOT NULL,
  rain_probability      integer NOT NULL DEFAULT 0,
  wind_speed            numeric(5,2) NOT NULL DEFAULT 0,
  uv_index              numeric(4,2) NOT NULL DEFAULT 0,
  staffing_suggestion   text NOT NULL DEFAULT '',
  inventory_suggestion  text NOT NULL DEFAULT '',
  fetched_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_location_date ON weather_cache(location_id, forecast_date ASC);

ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_weather_cache" ON weather_cache FOR ALL TO anon USING (true) WITH CHECK (true);

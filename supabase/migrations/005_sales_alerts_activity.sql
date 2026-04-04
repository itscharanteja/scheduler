-- ============================================================
-- 005: Sales, Dashboard Alerts, Employee Activity
-- ============================================================

-- Daily sales per location
CREATE TABLE IF NOT EXISTS daily_sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date            date NOT NULL,
  revenue         numeric(10,2) NOT NULL DEFAULT 0,
  orders          integer NOT NULL DEFAULT 0,
  average_order_value numeric(8,2) NOT NULL DEFAULT 0,
  labor_cost      numeric(10,2) NOT NULL DEFAULT 0,
  comparison_revenue numeric(10,2) NOT NULL DEFAULT 0,
  peak_label      text NOT NULL DEFAULT '',
  hourly_revenue  jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_location_date ON daily_sales(location_id, date DESC);

-- Dashboard alerts per location
CREATE TABLE IF NOT EXISTS dashboard_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tone        text NOT NULL CHECK (tone IN ('warning','info','success','critical')),
  title       text NOT NULL,
  message     text NOT NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_location ON dashboard_alerts(location_id, created_at DESC);

-- Employee activity feed
CREATE TABLE IF NOT EXISTS employee_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('shift','stock','message','task','attendance')),
  title       text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  timestamp   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_activity_location ON employee_activity(location_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_employee_activity_employee ON employee_activity(employee_id, timestamp DESC);

-- RLS
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_daily_sales" ON daily_sales FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_dashboard_alerts" ON dashboard_alerts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_employee_activity" ON employee_activity FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- Seed data for location 22222222-2222-4222-8222-222222222222
-- ============================================================

-- Sales: last 7 days
INSERT INTO daily_sales (location_id, date, revenue, orders, average_order_value, labor_cost, comparison_revenue, peak_label, hourly_revenue) VALUES
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE,
  54820, 462, 118.7, 14980, 51240, '13:00-14:00',
  '[0,0,0,0,0,0,0,0,0,0,0,2100,4200,5820,4630,3980,4200,5100,6200,7400,5800,3200,1800,410]'
),
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE - INTERVAL '1 day',
  49200, 415, 118.6, 13800, 47800, '12:00-13:00',
  '[0,0,0,0,0,0,0,0,0,0,1800,3900,5600,4200,3800,3600,4100,4900,5800,6200,5100,2900,1500,300]'
),
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE - INTERVAL '2 days',
  61340, 498, 123.2, 15600, 58900, '18:00-19:00',
  '[0,0,0,0,0,0,0,0,0,0,2200,4100,5200,4800,4100,4300,5800,7200,8600,6900,4200,2100,1200,540]'
),
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE - INTERVAL '3 days',
  47600, 392, 121.4, 13200, 45100, '12:00-13:00',
  '[0,0,0,0,0,0,0,0,0,0,1600,3600,5100,4100,3500,3200,3900,4600,5400,5900,4800,2600,1300,200]'
),
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE - INTERVAL '4 days',
  52100, 441, 118.1, 14200, 49800, '13:00-14:00',
  '[0,0,0,0,0,0,0,0,0,0,1900,3800,5400,5600,4000,3700,4000,4800,5600,6100,5300,2900,1500,350]'
),
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE - INTERVAL '5 days',
  58900, 476, 123.7, 15200, 56200, '18:00-19:00',
  '[0,0,0,0,0,0,0,0,0,0,2000,4000,5000,4600,3900,4200,5600,6800,8100,6500,4000,2000,1100,500]'
),
(
  '22222222-2222-4222-8222-222222222222',
  CURRENT_DATE - INTERVAL '6 days',
  43800, 371, 118.1, 12400, 42000, '12:00-13:00',
  '[0,0,0,0,0,0,0,0,0,0,1400,3200,4800,3900,3200,3000,3600,4400,5100,5500,4500,2400,1100,200]'
)
ON CONFLICT (location_id, date) DO NOTHING;

-- Alerts: active (unresolved)
INSERT INTO dashboard_alerts (location_id, tone, title, message) VALUES
(
  '22222222-2222-4222-8222-222222222222',
  'warning',
  'Inventory watch',
  'Pickles are below target level. Reorder before the Saturday dinner rush to avoid running out mid-service.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'info',
  'Weather context',
  'Rain expected 14:00-18:00. Delivery demand typically rises 20% in wet weather — consider adding one driver.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'success',
  'Sales on track',
  'Revenue is 7% ahead of the same day last week. Current pace supports the weekly target.'
);

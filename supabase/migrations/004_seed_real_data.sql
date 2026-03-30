-- Seed real employee data for Mister York Stigs Center branch
-- Location: Importgatan 2-4, Hisings Backa, Göteborg

-- ============================================================================
-- PART 1: Add new columns to employees table
-- ============================================================================

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_percent integer;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS monthly_hours integer;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS monthly_salary numeric(10,2);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS labour_cost_per_hour numeric(10,2);

-- ============================================================================
-- PART 2: Insert Location (or replace if exists)
-- ============================================================================

INSERT INTO public.locations (id, name, address)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'Mister York — Stigs Center',
  'Importgatan 2-4, Hisings Backa, Göteborg'
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Mister York — Stigs Center',
  address = 'Importgatan 2-4, Hisings Backa, Göteborg';

-- ============================================================================
-- PART 3: Delete old sample data (before seeding new data)
-- ============================================================================

DELETE FROM public.shifts WHERE location_id = '22222222-2222-4222-8222-222222222222';
DELETE FROM public.employees WHERE location_id = '22222222-2222-4222-8222-222222222222';

-- ============================================================================
-- PART 4: Insert Employees (Real Data)
-- ============================================================================

-- 1. Beryvan - General Manager
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333301', 'Beryvan', 'shiftleader', 'GM', 100, 40, 48,
   'full-time', 173, 37000.00, 213.87, 213.87, '22222222-2222-4222-8222-222222222222');

-- 2. AM (Vacant)
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333302', 'AM (vacant)', 'shiftleader', 'AM', 100, 40, 48,
   'full-time', 173, 0.00, 0.00, 0.00, '22222222-2222-4222-8222-222222222222');

-- 3. Omid - Shift Leader
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333303', 'Omid', 'shiftleader', 'SL', 70, 28, 36,
   'part-time', 121, 21193.00, 175.00, 175.00, '22222222-2222-4222-8222-222222222222');

-- 4. Narges - Shift Leader
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333304', 'Narges', 'shiftleader', 'SL', 70, 28, 36,
   'part-time', 121, 19194.00, 158.50, 158.50, '22222222-2222-4222-8222-222222222222');

-- 5. Jero - Shift Leader
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333305', 'Jero', 'shiftleader', 'SL', 60, 24, 32,
   'part-time', 104, 15621.00, 150.49, 150.49, '22222222-2222-4222-8222-222222222222');

-- 6. Reddy - Shift Leader
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333306', 'Reddy', 'shiftleader', 'SL', 70, 28, 36,
   'part-time', 121, 19311.00, 159.46, 159.46, '22222222-2222-4222-8222-222222222222');

-- 7. Charan - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333307', 'Charan', 'service', 'TM', 60, 24, 32,
   'part-time', 104, 15514.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 8. Diana - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333308', 'Diana', 'service', 'TM', 10, 4, 10,
   'hourly', 17, 2586.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 9. Hafiza - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333309', 'Hafiza', 'service', 'TM', 70, 28, 36,
   'part-time', 121, 18100.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 10. Lanya - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333310', 'Lanya', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 517.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 11. Nasrin - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333311', 'Nasrin', 'service', 'TM', 100, 40, 48,
   'full-time', 173, 25857.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 12. Vinod - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333312', 'Vinod', 'service', 'TM', 70, 28, 36,
   'part-time', 121, 18100.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 13. Angelo - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333313', 'Angelo', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 385.00, 111.27, 111.27, '22222222-2222-4222-8222-222222222222');

-- 14. Bamshad - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333314', 'Bamshad', 'service', 'TM', 5, 2, 10,
   'hourly', 9, 1293.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 15. Elias - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333315', 'Elias', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 517.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 16. Esafan - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333316', 'Esafan', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 430.00, 124.32, 124.32, '22222222-2222-4222-8222-222222222222');

-- 17. Luna K - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333317', 'Luna K', 'service', 'TM', 1, 1, 6,
   'hourly', 1, 137.00, 98.87, 98.87, '22222222-2222-4222-8222-222222222222');

-- 18. Maya - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333318', 'Maya', 'service', 'TM', 5, 2, 10,
   'hourly', 9, 1051.00, 121.51, 121.51, '22222222-2222-4222-8222-222222222222');

-- 19. Medin - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333319', 'Medin', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 373.00, 107.85, 107.85, '22222222-2222-4222-8222-222222222222');

-- 20. Naemi - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333320', 'Naemi', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 430.00, 124.32, 124.32, '22222222-2222-4222-8222-222222222222');

-- 21. Sara E - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333321', 'Sara E', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 517.00, 149.46, 149.46, '22222222-2222-4222-8222-222222222222');

-- 22. Shafiqa - Team Member
INSERT INTO public.employees
  (id, name, role, position, contract_percent, contract_hours, max_weekly_hours,
   employment_type, monthly_hours, monthly_salary, hourly_rate, labour_cost_per_hour, location_id)
VALUES
  ('33333333-3333-4333-8333-333333333322', 'Shafiqa', 'service', 'TM', 2, 1, 8,
   'hourly', 3, 389.00, 112.42, 112.42, '22222222-2222-4222-8222-222222222222');

-- ============================================================================
-- PART 5: Insert Shifts (2 weeks: 2025-06-02 to 2025-06-15)
-- ============================================================================

-- Week 1: June 2-8, 2025

-- Monday 2025-06-02
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-02', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-02', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-02', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-02', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-02', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Tuesday 2025-06-03
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-03', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333303', '2025-06-03', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-03', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-03', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-03', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-03', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Wednesday 2025-06-04
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-04', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333304', '2025-06-04', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-04', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-04', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-04', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-04', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Thursday 2025-06-05
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-05', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333305', '2025-06-05', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-05', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-05', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-05', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-05', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Friday 2025-06-06
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-06', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333306', '2025-06-06', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-06', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-06', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-06', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-06', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333314', '2025-06-06', '17:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Saturday 2025-06-07 (Weekend - more staff)
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333303', '2025-06-07', '10:00', '18:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-07', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-07', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-07', '12:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333308', '2025-06-07', '14:00', '22:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333318', '2025-06-07', '16:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333314', '2025-06-07', '17:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333313', '2025-06-07', '18:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Sunday 2025-06-08
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333304', '2025-06-08', '10:00', '18:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-08', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-08', '12:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-08', '14:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Week 2: June 9-15, 2025

-- Monday 2025-06-09
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-09', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-09', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-09', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-09', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-09', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Tuesday 2025-06-10
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-10', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333305', '2025-06-10', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-10', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-10', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-10', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-10', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Wednesday 2025-06-11
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-11', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333306', '2025-06-11', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-11', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-11', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-11', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-11', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Thursday 2025-06-12
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-12', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333303', '2025-06-12', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-12', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-12', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-12', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-12', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Friday 2025-06-13
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333301', '2025-06-13', '08:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333304', '2025-06-13', '10:00', '16:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-13', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-13', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-13', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-13', '16:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333314', '2025-06-13', '17:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333318', '2025-06-13', '18:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Saturday 2025-06-14 (Weekend - more staff)
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333305', '2025-06-14', '10:00', '18:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-14', '08:00', '16:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-14', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-14', '12:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333307', '2025-06-14', '14:00', '22:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333319', '2025-06-14', '16:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333314', '2025-06-14', '17:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333313', '2025-06-14', '18:00', '00:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

-- Sunday 2025-06-15
INSERT INTO public.shifts (id, employee_id, date, start_time, end_time, role, location_id, status, created_by_ai)
VALUES
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333306', '2025-06-15', '10:00', '18:00', 'shiftleader', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333311', '2025-06-15', '10:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333312', '2025-06-15', '12:00', '18:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333309', '2025-06-15', '14:00', '20:00', 'service', '22222222-2222-4222-8222-222222222222', 'published', false);

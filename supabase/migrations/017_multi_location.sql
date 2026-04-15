-- 017_multi_location.sql
-- Add Gamla Ullevi branch for regional manager (super_admin) multi-location support

INSERT INTO public.locations (id, name, address)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'Mister York — Gamla Ullevi',
  'Gamla Ullevi, Göteborg'
)
ON CONFLICT (id) DO UPDATE SET
  name    = 'Mister York — Gamla Ullevi',
  address = 'Gamla Ullevi, Göteborg';

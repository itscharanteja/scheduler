# Skift

Skift is a staff scheduling app for quick-service restaurants in Sweden.
It helps managers run weekly shift planning, manage employee contracts, and generate draft schedules using AI.

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth)
- Anthropic Claude API (schedule generation with GDPR + labor law validation)
- OpenAI API (alternative scheduling route)
- Sonner (toast notifications)

## Features

### Scheduling
- Gantt-style weekly schedule builder with time bars
- Week navigation via `?week=YYYY-Www`
- Add/edit/delete shifts with role and employee assignment
- Filter by role and employee
- AI-generated shift suggestions with apply/dismiss flow
- Week summary (hours + estimated labor cost)

### Employee Management
- Create, edit, delete employee profiles
- Contract/max hours and role metadata
- Loading and empty states

### AI Agent
- Natural language prompt input (EN/SV)
- Prompt examples
- Generated draft schedule preview grouped by day
- Labor law violation warnings (Swedish Arbetstidslagen)
- GDPR-safe: employee names anonymised before sending to Claude
- Apply generated shifts to Supabase as drafts
- Hour overage warnings

### Multi-Location Support
- Regional managers can switch between location branches
- Active branch stored in `LocationContext` with localStorage persistence
- Branch switcher in the sidebar nav

### Authentication & Roles
- Supabase Auth with session cookies (server-side verified on every API request)
- Four roles: `super_admin`, `admin`, `user_lead`, `user`
- Role-based nav visibility and feature access
- `hasRole()` hook for conditional UI rendering

### Chat
- Team chat channels with member management
- Pin, edit, soft-delete messages
- Automatic low-stock alerts posted to managers channel

### Operations
- Shift leader logs (narrative daily logs)
- Task board
- Inventory management with low/critical stock alerts
- Daily sales tracking
- Dashboard alerts feed
- Employee activity feed

### App UX
- Bilingual EN/SV language toggle with localStorage persistence
- Responsive dashboard layout
- Toast notifications for success/error/warning flows
- React error boundaries — crashes show a recovery card instead of a blank screen

## Architecture

### API Security
All API routes verify the caller's session server-side via `lib/api-auth.ts`:

```typescript
const caller = await getCallerSession(req); // { userId, role, employeeId, locationId }
const locationId = resolveLocationId(caller, req.nextUrl.searchParams.get("locationId"));
```

`resolveLocationId()` enforces location isolation — non-super_admin callers always get their session-derived `locationId`, regardless of what the client sends.

### Data Layer
Supabase queries are organized into domain modules under `lib/supabase/`:

```
lib/supabase/
  client.ts       — supabaseClient, requireClient, normalizeSupabaseError
  employees.ts    — getEmployees, createEmployee, updateEmployee, deleteEmployee
  shifts.ts       — getShiftsByWeek, getShiftsByMonth, createShift, updateShift, deleteShift
  chat.ts         — getChannels, sendMessage, getMessages, pinMessage, editMessage, deleteMessage
  tasks.ts        — getTasks, createTask, updateTask, deleteTask
  shift-logs.ts   — getShiftLogs, createShiftLog, updateShiftLog, getFlaggedLogs
  inventory.ts    — getInventory, getLowStockItems, updateInventoryItem
  sales.ts        — getSales
  alerts.ts       — getAlerts, resolveAlert
  activity.ts     — getActivity, getEmployeeActivity
  weather.ts      — getCachedWeather, upsertWeatherForecast
  checklists.ts   — getChecklistTemplate, upsertChecklistTemplate, getChecklistSubmission
  locations.ts    — getLocations
  index.ts        — barrel re-exports
```

All imports use `@/lib/supabase` — TypeScript resolves this to `lib/supabase/index.ts` automatically.

### Error Boundaries
- `app/error.tsx` — root-level catch-all (auth pages, unexpected crashes)
- `app/(dashboard)/error.tsx` — dashboard boundary (sidebar stays visible, content area shows recovery card)
- `components/error-boundary.tsx` — reusable class component for wrapping high-risk sub-trees (e.g. the Gantt chart)

## Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill values:

```bash
cp .env.local.example .env.local
```

Required keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

Optional keys:

- `OPENAI_API_KEY` — enables the OpenAI scheduling route
- `NEXT_PUBLIC_OPENWEATHER_API_KEY` — enables live weather forecasts

### 3. Supabase setup

Run migrations in order from `supabase/migrations/`:

1. `001_initial_schema.sql` — locations, employees, shifts, inventory, chat tables
2. `002_roles_to_service_shiftleader_rutin.sql` — role model migration
3. `003_rls_policies.sql` — row-level security for core tables
4. `004_seed_real_data.sql` — seed employees, shifts, chat channels/messages
5. `005_sales_alerts_activity.sql` — daily_sales, dashboard_alerts, employee_activity
6. `006_tasks.sql` — shift_logs + tasks tables
7. `007_auth_roles.sql` — user_profiles table + auto-create trigger
8. `008_tasks_created_by.sql` — adds created_by to tasks
9. `009_auto_delete_completed_tasks.sql` — auto-cleanup trigger
10. `010_authenticated_rls.sql` — RLS for authenticated users
11. `011_user_profiles_rls.sql` — RLS for user_profiles
12. `012_social_feed.sql` — social feed tables
13. `013_user_profiles_email.sql` — email column on user_profiles
14. `014_chat_features.sql` — pin/edit/soft-delete + channel_members table
15. `015_channel_created_by.sql` — channel ownership for permission enforcement
16. `016_shift_checklists.sql` — shift leader checklist templates and submissions
17. `017_multi_location.sql` — multi-location branch support

### 4. Start development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Commands

```bash
npm run dev           # Start development server
npm run build         # Production build
npm run lint          # Run ESLint
npx tsc --noEmit     # TypeScript type check
```

## Notes

- If Supabase env vars are missing, the app shows non-blocking warnings and disables data actions.
- The GDPR anonymisation layer applies only to the Claude scheduling route — employee names are never sent to the Claude API.
- Labor law validation (Swedish Arbetstidslagen) runs server-side after de-anonymisation.
- Weather context is injected into both Claude and OpenAI scheduling prompts; falls back to mock data if the API is unavailable.

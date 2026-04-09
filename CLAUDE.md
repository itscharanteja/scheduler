# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## UI Change Rules

This project uses **Next.js + Tailwind CSS + shadcn/ui**. Follow these rules for ANY UI change:

1. **Always run `npx tsc --noEmit` after edits** — do not report done if there are type errors.
2. **Always run `npm run build` before declaring a UI task complete** — a clean build is required.
3. **Do not change layout structure, spacing, or global styles unless explicitly asked.** Surgical edits only.
4. **Never introduce new CSS classes or Tailwind utilities that conflict with the existing design system** (defined in `globals.css` and `tailwind.config.ts`).
5. **If a change affects more than 2 components**, list all affected files and confirm with the user before proceeding.
6. **Do not refactor, rename, or reorganize components as a side effect of a UI fix.**

## Project Overview

**Skift** is a staff scheduling application for quick-service restaurants (QSR) in Sweden. It helps managers:

- Create and manage weekly shift schedules
- Generate draft schedules using AI (Claude or OpenAI)
- Track employee contracts and labor law compliance
- Manage inventory with automatic low-stock alerts
- Log shift performance and issues
- Communicate via team chat channels
- Factor in weather forecasts for staffing decisions

**Tech Stack**: Next.js 16 (App Router) + TypeScript, Tailwind CSS + shadcn/ui, Supabase PostgreSQL, Anthropic Claude + OpenAI APIs, Sonner toast notifications.

## Commands

```bash
npm run dev           # Start development server (http://localhost:3000)
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
npx tsc --noEmit     # TypeScript type check (no emit)
```

## Authentication & Roles

### Role System

Four roles are defined in `public.user_profiles.role`:

| Role          | Access                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| `super_admin` | Full system access — all features, all data                           |
| `admin`       | Scheduling, employee management, AI agent, all app features           |
| `user_lead`   | Shift logs, sales, inventory, tasks, schedule (view only)             |
| `user`        | Tasks, schedule (view only), chat                                     |

### Auth Context

**`context/AuthContext.tsx`** — wraps the entire app via `AuthProvider` in `app/layout.tsx`:

- `useAuth()` — returns `{ user, loading, signIn, signOut, hasRole }`
- `user` — `{ id, email, role, name }` or `null` if not signed in
- `hasRole(...roles)` — returns `true` if the current user has any of the given roles
- Dev bypass: if Supabase is not configured, `hasRole()` always returns `true`

```tsx
const { user, hasRole } = useAuth();
if (!hasRole("admin", "super_admin")) return <AccessDenied />;
```

### Protected Routes

**`middleware.ts`** redirects unauthenticated users to `/login`. Public routes (no auth required):
- `/login`
- `/reset-password`
- `/auth/confirm` — exchanges Supabase one-time code for a session cookie

### Nav Visibility by Role

| Nav item    | Minimum role |
| ----------- | ------------ |
| Dashboard   | all          |
| Tasks       | all          |
| Schedule    | all          |
| Messages    | all          |
| Sales       | user_lead    |
| Inventory   | user_lead    |
| Reports     | user_lead    |
| Team        | admin        |
| AI Agent    | admin        |
| Settings    | admin        |

### Managing Users

1. Invite via **Supabase Dashboard → Authentication → Users → Invite user**
2. The trigger in `007_auth_roles.sql` auto-creates a `user_profiles` row (default role: `user`)
3. Promote role in SQL Editor:

```sql
update public.user_profiles
set role = 'admin',
    employee_id = '<employee-uuid>'   -- optional: link to employees table
where id = '<auth-user-uuid>';
```

4. To set a password directly (bypasses email):

```sql
update auth.users
set encrypted_password = crypt('newpassword', gen_salt('bf'))
where email = 'user@example.com';
```

5. Configure **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** to include `http://localhost:3000/**` and your production domain for password reset emails to work.

## Architecture & Key Patterns

### Route Structure

All dashboard pages live in `app/(dashboard)/` — the route group strips the segment from the URL so `/dashboard/schedule` is just `/schedule`. Auth pages live in `app/(auth)/`.

```
app/
  layout.tsx              — root layout: AuthProvider + Toaster
  (auth)/
    layout.tsx            — bare layout (no shell)
    login/page.tsx
    reset-password/page.tsx
  (dashboard)/
    layout.tsx            — wraps children in LanguageAppShell
    page.tsx              — /
    schedule/             — /schedule
    logs/                 — /logs (tasks)
    chat/                 — /chat
    sales/                — /sales
    inventory/            — /inventory
    reports/              — /reports
    employees/            — /employees
    ai-agent/             — /ai-agent
    settings/             — /settings
  auth/
    confirm/route.ts      — /auth/confirm (code exchange for password reset)
```

### API Routes (Feature-Based Organization)

All API routes follow the pattern `/app/api/{feature}/{action}/route.ts`:

- **Chat** (`/api/chat/*`): Channels, messages, pinning, sending, member management
  - GET /api/chat/channels
  - GET /api/chat/messages?channelId=&limit= — includes is_pinned, is_edited, is_deleted fields
  - PATCH /api/chat/messages — edit own message (senderId required)
  - DELETE /api/chat/messages — soft-delete; admins can delete any, users only own
  - POST /api/chat/send
  - PATCH /api/chat/pin
  - POST /api/chat/channels/create — accepts createdBy (employee UUID)
  - PATCH /api/chat/channels/[id] — edit name/description (creator or super_admin only)
  - DELETE /api/chat/channels/[id] — delete channel (creator or super_admin only)
  - GET /api/chat/members?channelId= — list channel members
  - POST /api/chat/members — add member { channelId, employeeId, addedBy }
  - DELETE /api/chat/members — remove member { channelId, employeeId }

- **Employees** (`/api/employees`):
  - GET /api/employees — all employees
  - GET /api/employees?hasAccount=true — only employees linked to a user_profiles row

- **Shift Logs** (`/api/shift-logs/*`): Daily shift leader narrative logs (not the task board)
  - GET /api/shift-logs (with optional limit, date filters)
  - GET /api/shift-logs/by-date, /api/shift-logs/flagged, /api/shift-logs/summary
  - POST /api/shift-logs/create
  - PATCH /api/shift-logs/update

- **Inventory** (`/api/inventory/*`): Stock management with auto-alerts
  - GET /api/inventory (all items), /api/inventory/low (alert items)
  - POST /api/inventory/update (triggers alert to managers chat if stock drops below critical)

- **Sales** (`/api/sales`): Daily sales data
  - GET /api/sales?locationId=&limit=

- **Alerts** (`/api/alerts`): Dashboard alerts
  - GET /api/alerts?locationId=
  - PATCH /api/alerts (resolve an alert)

- **Activity** (`/api/activity`): Employee activity feed
  - GET /api/activity?locationId=&limit=

- **AI Scheduling** (`/api/generate-schedule*`):
  - POST /api/generate-schedule (Claude, with GDPR + labor law validation)
  - POST /api/generate-schedule-openai (OpenAI alternative)
  - Both include weather context injection and return warnings/violations

- **Weather** (`/api/weather/*`): Forecast data
  - GET /api/weather (cached forecasts)
  - POST /api/weather/refresh (fetch from OpenWeather API)

### Data Layer Pattern

**`lib/supabase.ts`** is the single source of truth for Supabase queries:

- Creates and caches `supabaseClient` (anon key auth)
- Provides helper `requireClient()` for auth-required operations
- Type mapping functions convert snake_case DB rows to camelCase app types:
  - `mapEmployee()`, `mapShift()`, `mapInventoryItem()`, `mapDailySales()`, `mapDashboardAlert()`, `mapEmployeeActivity()`, etc.
- Wraps all queries with error handling and logging
- Exports both queries and mutations with consistent patterns

Example pattern:

```typescript
export async function getShifts(locationId: string): Promise<Shift[]> {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("shifts")
    .select("*")
    .eq("location_id", locationId);
  if (error) throw error;
  return (data as DbShiftRow[]).map(mapShift);
}
```

### Types

**`lib/types.ts`** defines the domain model with clear camelCase names:

- `Employee`, `Shift`, `WeekSchedule`, `Location`
- `InventoryItem`, `InventoryStatus` (ok|low|critical)
- `ShiftLog`, `CreateShiftLogPayload`, `ShiftLeaderLogEntry`
- `ChatChannel` (includes `createdBy?`), `ChatMessage` (includes `isPinned?`, `isEdited?`, `editedAt?`, `isDeleted?`), `ChannelMember`
- `WeatherForecast`, `Sale`, `DashboardSummary`
- `SalesDay`, `DashboardAlert`, `EmployeeActivityItem`

All types match the Supabase schema (mapping handled in supabase.ts).

### Utilities

**`lib/gdpr.ts`** — GDPR compliance layer (Claude route only):

- `anonymiseEmployees(employees)` → `{ anonymised, mapping: Map<anonName, realName> }`
- `anonymiseShifts(shifts, mapping)` → uses reverse mapping
- `deAnonymiseResponse(response, mapping)` → recursively restores real names

**`lib/labour-law.ts`** — Swedish Arbetstidslagen validation (Claude route only):

- Constants: `MAX_SHIFT_HOURS=10`, `MIN_REST_HOURS=11`, `MAX_WEEKLY_HOURS=48`
- `LawViolation` type: violationType (shift_too_long|insufficient_rest|weekly_hours_exceeded|contract_hours_exceeded), severity (warning|critical)
- Validators: `validateShiftLength()`, `validateRestPeriods()`, `validateWeeklyHours()`
- Orchestrator: `validateSchedule(shifts, employees)` returns `{ violations, criticalCount, warningCount, isValid, summary }`

**`lib/weather.ts`** — Weather forecast integration:

- `getMockWeather()` — fallback data when API unavailable
- `WeatherForecast` type includes staffingSuggestion and inventorySuggestion
- Caching in Supabase, refresh via POST /api/weather/refresh

### Cross-Module Triggers

**Inventory → Chat** (POST /api/inventory/update):
When stock drops below critical threshold AND was not already critical, automatically posts alert message to the "managers" chat channel via `sendMessage()`. This prevents duplicate alerts and ensures managers are notified.

## Development Notes

### Environment Setup

Copy `.env.local.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=... (optional, for OpenAI route)
NEXT_PUBLIC_OPENWEATHER_API_KEY=... (optional, for weather)
```

If Supabase vars are missing, the app shows warnings, disables data actions (graceful degradation), and `hasRole()` returns `true` for everything (dev bypass).

### Supabase Migrations

Run in order from `supabase/migrations/`:

1. `001_initial_schema.sql` — locations, employees, shifts, inventory, chat tables
2. `002_roles_to_service_shiftleader_rutin.sql` — role model migration
3. `003_rls_policies.sql` — row-level security for core tables
4. `004_seed_real_data.sql` — seed employees, shifts, chat channels/messages
5. `005_sales_alerts_activity.sql` — daily_sales, dashboard_alerts, employee_activity tables + seed
6. `006_tasks.sql` — shift_logs table (narrative logs) + tasks table (task board) + seed tasks
7. `007_auth_roles.sql` — user_profiles table + auto-create trigger on auth.users signup
8. `008_tasks_created_by.sql` — adds created_by to tasks
9. `009_auto_delete_completed_tasks.sql` — auto-cleanup trigger for completed tasks
10. `010_authenticated_rls.sql` — RLS for authenticated users
11. `011_user_profiles_rls.sql` — RLS for user_profiles
12. `012_social_feed.sql` — social feed tables
13. `013_user_profiles_email.sql` — email column on user_profiles
14. `014_chat_features.sql` — adds is_pinned, is_edited, edited_at, is_deleted to chat_messages; creates channel_members table
15. `015_channel_created_by.sql` — adds created_by to chat_channels for permission enforcement

### shift_logs vs tasks

These are two different concepts — do not confuse them:

| Table        | Purpose                                      | Accessible to          |
| ------------ | -------------------------------------------- | ---------------------- |
| `shift_logs` | Narrative daily log written by shift leaders | user_lead, admin, super_admin |
| `tasks`      | Individual actionable task items (task board)| all roles              |

The `/logs` route in the UI is the **task board** (queries `tasks` table). The `shift_logs` table is used by the `/api/shift-logs/*` routes and the AI scheduling flow.

### Response Patterns

Standard API response format (all routes):

- **Success**: `{ success: true, data: T, ... }` with `status: 200|201`
- **Error**: `{ error: "message", success?: false }` with `status: 400|404|500`
- **Validation failures**: `status: 400` with descriptive error message
- **Not found**: `status: 404`
- **Server errors**: `status: 500` with console.error logging

### Testing

Bash test scripts in `tests/`:

- `test-chat-api.sh` — tests 6 chat endpoints
- `test-shift-logs-api.sh` — tests 6 shift log endpoints
- `test-scheduling-with-weather.sh` — tests Claude scheduling with/without weather

Run with: `npm run dev` then `./tests/script.sh` (adjust `BASE_URL`, `LOCATION_ID` as needed).

### Important Constraints

- **GDPR Layer**: Applies ONLY to Claude route (`/api/generate-schedule`), NOT OpenAI
  - Employee names anonymized before API call, de-anonymized in response
  - Real names never sent to Claude

- **Labor Law Validation**: Applies ONLY to Claude route
  - Validates after de-anonymization (needs real names + contract hours)
  - Returns violations with severity (critical/warning) for UI display
  - Critical violations prevent schedule publication (per Swedish law)

- **Weather Injection**: Both Claude and OpenAI routes support weather context
  - Fetched from Supabase cache or OpenWeather API
  - Falls back to mock data if API unavailable
  - Included in system prompt to influence AI scheduling decisions

## TypeScript & Linting

- Run `npx tsc --noEmit` to check types without emitting
- Full build includes type check: `npm run build`
- ESLint config in `eslint.config.mjs`
- Target: strict mode, no implicit any

## General Behavior Rules

- **Do only what was asked.** Do not clone repos, run heavy scans, install packages, or perform operations beyond the explicit request.
- **Confirm before touching more than 2 files** in a single task — list affected files and wait for approval.
- **Never skip hooks** (`--no-verify`) or bypass TypeScript checks to force a build through.

## Data Layer Rules

- **Always verify actual DB column names** before writing a new `mapX()` function or Supabase query. Read the migration files in `supabase/migrations/` or check existing `DbXRow` types in `lib/supabase.ts`. Do NOT assume field names from the TypeScript type — the DB uses `snake_case` and the app uses `camelCase`, and they don't always match predictably (e.g. `sender_id` not `employee_id`, `message` not `content`).
- **All Supabase queries go in `lib/supabase.ts`** — never query Supabase directly from a page or API route.
- **`LOCATION_ID`** is defined in `lib/constants.ts` (`"22222222-2222-4222-8222-222222222222"`) and must be passed to every location-scoped query. Missing it causes silently empty results.
- **Relational joins**: `chat_messages.sender_id` → `employees.id`. Always join `employees(name, role)` when fetching messages to get sender info.
- **Ambiguous FK joins**: `channel_members` has two FKs to `employees` (`employee_id` and `added_by`). Always use the explicit hint form: `employees!channel_members_employee_id_fkey(name, role)` — not just `employees(name, role)`.
- **Weather table**: The Supabase table is `weather_cache`, not `weather_forecasts`. Always use `weather_cache` in queries.

## Real Data Sources

All data is now backed by real Supabase tables. Use these functions (all in `lib/supabase.ts`):

| Data                | Function(s)                                      |
| ------------------- | ------------------------------------------------ |
| Employees           | `getEmployees()`                                 |
| Shifts              | `getShiftsByWeek(weekStart)`                     |
| Tasks (task board)  | `getShiftLogs(locationId)` — queries tasks table |
| Shift leader logs   | `/api/shift-logs/*` routes                       |
| Chat channels       | `getChannels(locationId)`                        |
| Chat messages       | `getMessages(channelId)`                         |
| Channel members     | `getChannelMembers(channelId)`, `addChannelMember()`, `removeChannelMember()` |
| Pin message         | `pinMessage(messageId, isPinned)`                |
| Edit message        | `editMessage(messageId, content)`                |
| Delete message      | `deleteMessage(messageId)` — soft delete         |
| Locations           | `getLocations()`                                 |
| Sales               | `getSales(locationId, limit?)`                   |
| Alerts              | `getAlerts(locationId)`, `resolveAlert(alertId)` |
| Activity feed       | `getActivity(locationId, limit?)`                |
| Employee activity   | `getEmployeeActivity(employeeId, limit?)`        |
| Weather (cached)    | `getCachedWeather(locationId)`, `upsertWeatherForecast()` — table: `weather_cache` |

There is no longer any permanent mock data — `mockSales`, `mockAlerts`, and `mockEmployeeActivity` have all been replaced with real DB tables and API functions.

## Chat Module — Permission Rules

| Action                        | super_admin | admin (creator) | admin (non-creator) | user_lead / user |
| ----------------------------- | ----------- | --------------- | ------------------- | ---------------- |
| Create channel                | ✓           | ✓               | ✓                   | ✗                |
| Edit channel name/description | ✓           | ✓               | ✗                   | ✗                |
| Delete channel                | ✓           | ✓               | ✗                   | ✗                |
| Manage members (add/remove)   | ✓           | ✓               | ✓                   | ✗                |
| Pin / unpin any message       | ✓           | ✓               | ✓                   | ✗                |
| Delete any message            | ✓           | ✓               | ✓                   | ✗                |
| Delete own message            | ✓           | ✓               | ✓                   | ✓                |
| Edit own message              | ✓           | ✓               | ✓                   | ✓                |

**Important**: The member list in the "Manage Members" dialog only shows employees who have a linked `user_profiles` account (`/api/employees?hasAccount=true`) and excludes the current user.

## Notes for Future Work

- ✓ All three AI scheduling modules (Claude GDPR, Claude labor law, OpenAI + weather) are integrated
- ✓ Chat module with automatic stock alerts via cross-module triggers
- ✓ Shift logs with flagging and summaries
- ✓ Inventory management with critical/low/ok status
- ✓ Authentication with role-based access (super_admin, admin, user_lead, user)
- ✓ Tasks table (task board at /logs) separate from shift_logs (narrative logs)
- ✓ Real APIs for sales, alerts, and activity — no more mock data
- ✓ Chat: full message actions (pin, edit, soft-delete), channel CRUD, member management
- ✓ AI scheduling: fixed role names, employee UUID handling, locationId, Promise.allSettled apply
- ✓ Schedule: Gantt chart with horizontal time bars, filter by role/employee, AI suggestion panel
- Future: Wire tasks table to `/logs` page (currently uses getShiftLogs which queries shift_logs, not tasks)
- Future: Build shift leader logs UI (restricted to user_lead+)
- Future: Role management UI so admins can assign roles without SQL
- Future: RLS tests, multi-location isolation verification

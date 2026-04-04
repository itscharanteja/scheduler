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

## Architecture & Key Patterns

### API Routes (Feature-Based Organization)

All API routes follow the pattern `/app/api/{feature}/{action}/route.ts`:

- **Chat** (`/api/chat/*`): Channels, messages, pinning, sending
  - GET /api/chat/channels
  - GET /api/chat/messages, /api/chat/pinned
  - POST /api/chat/send
  - PATCH /api/chat/pin
  - POST /api/chat/channels/create

- **Shift Logs** (`/api/shift-logs/*`): Daily shift leader logging
  - GET /api/shift-logs (with optional limit, date filters)
  - GET /api/shift-logs/by-date, /api/shift-logs/flagged, /api/shift-logs/summary
  - POST /api/shift-logs/create
  - PATCH /api/shift-logs/update

- **Inventory** (`/api/inventory/*`): Stock management with auto-alerts
  - GET /api/inventory (all items), /api/inventory/low (alert items)
  - POST /api/inventory/update (triggers alert to managers chat if stock drops below critical)

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
  - `mapEmployee()`, `mapShift()`, `mapInventoryItem()`, etc.
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
- `ShiftLog`, `CreateShiftLogPayload`
- `ChatChannel`, `ChatMessage`, `SendMessagePayload`
- `WeatherForecast`, `Sale`, `DashboardSummary`

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

If Supabase vars are missing, the app shows warnings and disables data actions (graceful degradation).

### Supabase Migrations

Run in order from `supabase/migrations/`:

1. `001_initial_schema.sql` — creates tables (locations, employees, shifts, etc.)
2. `002_roles_to_service_shiftleader_rutin.sql` — if migrating role model
3. `003_rls_policies.sql` — row-level security

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

## Mock Data Policy

Some data intentionally has no real API and must stay as mock data:

| Data                   | File               | Reason                      |
| ---------------------- | ------------------ | --------------------------- |
| `mockSales`            | `lib/mock-data.ts` | No sales API exists         |
| `mockAlerts`           | `lib/mock-data.ts` | No alerts API exists        |
| `mockEmployeeActivity` | `lib/mock-data.ts` | No activity feed API exists |

Do NOT attempt to replace these with API calls — they are permanent mock data for now.

Real data sources (use Supabase / API routes):

- Employees → `getEmployees()`
- Shifts → `getShiftsByWeek()`
- Shift logs / tasks → `getShiftLogs()`, `createShiftLog()`, `updateShiftLog()`
- Chat channels → `getChannels()` or `/api/chat/channels`
- Chat messages → `getMessages()` or `/api/chat/messages`
- Locations → `getLocations()`

## Notes for Future Work

- ✓ All three AI scheduling modules (Claude GDPR, Claude labor law, OpenAI + weather) are integrated
- ✓ Chat module with automatic stock alerts via cross-module triggers
- ✓ Shift logs with flagging and summaries
- ✓ Inventory management with critical/low/ok status
- Future: Consider adding RLS (row-level security) tests, multi-location isolation verification

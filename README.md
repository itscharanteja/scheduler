# Scheduler

Scheduler is a staff scheduling app for Mister York (Gothenburg, Sweden).  
It helps managers run weekly shift planning, manage employee contracts, and generate draft schedules using AI.

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + API)
- Anthropic Claude API (schedule generation)
- Sonner (toast notifications)

## Features

- Employee management:
  - Create, edit, delete employee profiles
  - Contract/max hours and role metadata
  - Loading and empty states
- Weekly schedule builder:
  - Week navigation via `?week=YYYY-Www`
  - Add/edit/delete shifts
  - AI-created shift markers
  - Week summary (hours + estimated labor cost)
- AI Agent:
  - Natural language prompt input
  - Prompt examples (EN/SV)
  - Generated draft schedule preview grouped by day
  - Explanation + warnings
  - Apply generated shifts to Supabase as drafts
  - Hour overage warnings
- App UX:
  - Bilingual EN/SV language toggle with localStorage persistence
  - Responsive dashboard layout
  - Toast notifications for success/error/warning flows

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
- `ANTHROPIC_API_KEY`

### 3. Supabase setup

Run migrations in order from `supabase/migrations`:

1. `001_initial_schema.sql`
2. `002_roles_to_service_shiftleader_rutin.sql` (only if migrating older role model)
3. `003_rls_policies.sql`

This creates:

- `locations`
- `employees`
- `shifts`

and seeds Mister York Gothenburg + sample employees.

### 4. Start development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- If Supabase env vars are missing, the app shows non-blocking warnings and disables data actions.
- The AI route is at `POST /api/generate-schedule` and expects:
  - `prompt`
  - `employees`
  - `existingShifts`
  - `weekStart`

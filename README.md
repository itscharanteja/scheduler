# Skift Blueprint

## System Overview
Skift is an intelligent staff scheduling and operations management system tailored for quick-service restaurants in Sweden. It provides weekly shift planning, employee contract management, AI-powered schedule optimization complying with Swedish labor law (Arbetstidslagen), multi-location restaurant support, inventory tracking, attendance punch kiosk, and team communications.

### Core Architectural Boundaries
- **Frontend / Presentation**: Next.js 16 App Router (`./app`) utilizing Tailwind CSS, Lucide icons, and shadcn/ui components (`./components`).
- **Client State**: Context providers (`./context`) and reactive hooks (`./hooks`) managing branch location switching and live UI states.
- **Backend API Routes**: Next.js serverless route handlers (`./app/api`) servicing operational endpoints, LLM integration, and real-time simulators.
- **Data & Security**: Supabase PostgreSQL database with Row Level Security (RLS) schemas and migrations (`./supabase`).
- **Business Logic & Utilities**: Shared helpers (`./lib`) encompassing Swedish labor law validation, GDPR anonymization, and Supabase server/browser clients.

---

## Local Interface & Invariants
- `[middleware.ts:middleware]` (function) - Edge routing middleware authenticating sessions and enforcing protected route redirection.
- `[next.config.ts:default]` (const) - Next.js compiler and runtime configuration.
- Invariants:
  - `[middleware.ts:L30]` Unauthenticated requests to protected `/app` or `/api` routes redirect to `/login` or return `401 Unauthorized`.
- Side Effects:
  - `[middleware.ts:L15]` Cookie inspection and Supabase auth token verification on every incoming HTTP request.

---

## Subdirectories & System Boundaries
- [app](./app/README.md) - Application router housing authentication views, kiosk interfaces, role-gated dashboard pages, and backend API routes.
- [components](./components/README.md) - Reusable UI elements, modals, forms, navigation shell, and layout modules.
- [context](./context/README.md) - React context providers including LocationContext for active restaurant branch switching.
- [hooks](./hooks/README.md) - Reusable React hooks for role-based authorization (`hasRole`) and mobile breakpoints.
- [lib](./lib/README.md) - Core backend logic, labor law validator, GDPR anonymization, simulator engines, and Supabase client bindings.
- [scripts](./scripts/README.md) - Repository utilities and data seeding scripts.
- [supabase](./supabase/README.md) - Supabase database migrations, tables, relations, and Row Level Security (RLS) policies.

---

## Global Invariants
- **Authentication & RBAC**: Every server-side request in `/api` must verify the Supabase auth cookie and enforce one of four role tiers (`super_admin`, `admin`, `user_lead`, `user`).
- **Swedish Labor Law (Arbetstidslagen)**: Automated schedule generation must not assign consecutive night shifts violating rest periods or exceed maximum statutory weekly hours without flagging violations.
- **GDPR Compliance**: Employee personally identifiable information (PII) must be anonymized before transmitting schedule prompts to external LLM APIs (Claude / OpenAI).

---

## Global Side Effects
- **Supabase Cloud / PostgreSQL**: Mutations across core relational tables: `shifts`, `employees`, `branches`, `shift_logs`, `chat_messages`, `inventory_items`, and `forms`.
- **External AI Providers**: Network requests to Anthropic Claude and OpenAI APIs for AI schedule generation and natural language parsing.
- **Client LocalStorage**: Persistence of active restaurant branch selections across browser sessions.

---

## System Verification
- Run: `npm run lint` or `npm run build`

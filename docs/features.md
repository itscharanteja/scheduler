# Feature Inventory

## Status key: ✅ Complete | ⚠️ Partial (see notes) | 🔲 Planned

---

### ✅ Scheduling
- Gantt-style weekly builder — `/schedule`
- Day view — `/schedule/day`
- Inline shift create/edit/delete (Popover)
- Week navigation via `?week=YYYY-Www`
- Role + employee filters

### ✅ Employee Management
- CRUD at `/employees` and `/employees/[id]`
- Contract hours, role, phone

### ✅ AI Schedule Generation
- Claude route (GDPR-safe, labor law validation) — `POST /api/generate-schedule`
- OpenAI route — `POST /api/generate-schedule-openai`
- Weather context injection

### ✅ Chat
- Channels, messages, pin/edit/soft-delete — `/chat`
- Member management (admin only)
- Auto low-stock alerts to managers channel

### ✅ Attendance — Punch In/Out
- Public kiosk at `/punch?loc=<locationId>` (no login required)
- Admin report at `/attendance` with date/employee filters, inline time editing
- PWA / Add to Home Screen support
- Schedule page Attendance tab (day view, scheduled vs actual)
- Data layer: `lib/supabase/attendance.ts`
- API: `GET/POST /api/punch/*`, `GET/PATCH /api/attendance/report`

### ⚠️ Custom Form Builder (migration 019 pending)
- Admin builds forms with typed fields — `/forms/[id]/edit`
- Field types: text, number, checkbox, date, select (static or linked to employees/inventory)
- user_lead fills forms — `/forms/[id]`
- Submission history with inline response detail — `/forms/[id]/submissions`
- Data layer: `lib/supabase/forms.ts`
- API: `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/[id]`, `POST /api/forms/[id]/submit`, `GET /api/forms/[id]/submissions`

### ✅ Shift Leader Features
- Narrative logs — `GET/POST /api/shift-logs/*`
- Checklist templates (morning/evening) — `/shift-logs`
- Task board — `/logs`

### ✅ Operations & Simulation
- Sales Dashboard & Simulator — `/sales` (live Poisson order engine, 24-hour distribution, scenario triggers, SSE ticker)
- Inventory Management & Depletion — `/inventory` (live recipe stock deduction, threshold warnings, quick restock modal)
- Simulation API — `/api/sim/*` (`status`, `start`, `pause`, `reset`, `speed`, `scenario`, `tick`, `stream`)
- Dashboard alerts feed — ✅ complete
- Employee activity feed — ✅ complete

### ⚠️ Settings & Notifications
- `GET/PUT /api/settings`, `GET/POST/PATCH/DELETE /api/notifications` are implemented but persist to an in-memory `globalThis` store (`lib/server/runtime-store.ts`), not a Supabase table. Data does not survive a server restart/redeploy and isn't shared across serverless instances. No migration exists for either. Needs a `settings`/`notifications` table + migration before this is production-durable.

### ✅ Multi-Location
- Branch switcher in sidebar (super_admin)
- `LocationContext` with localStorage persistence
- All API routes enforce location isolation via `resolveLocationId()`

### ✅ Auth & Roles
- Supabase Auth, server-side session on every API request (`lib/api-auth.ts`)
- Roles: `super_admin`, `admin`, `user_lead`, `user`
- `hasRole()` for UI gating, `getCallerSession()` + `hasRole()` for API gating

---

## Key files for a new session

| Area | File |
|------|------|
| Project rules | `CLAUDE.md` |
| Types | `lib/types.ts` |
| DB queries | `lib/supabase/` (domain modules) + `lib/supabase/index.ts` (barrel) |
| API auth | `lib/api-auth.ts` — `getCallerSession`, `hasRole`, `resolveLocationId`, `serviceClient` |
| Navigation | `components/app-shell.tsx` — `navItems` array + `getPageMeta` |
| Middleware | `middleware.ts` — public paths: `/login`, `/reset-password`, `/auth/confirm`, `/punch` |

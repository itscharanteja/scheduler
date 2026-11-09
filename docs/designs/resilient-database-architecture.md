# Resilient Database Architecture & Degraded Mode Cache

*   **Author:** Charan Sri Teja
*   **Status:** Approved
*   **Date:** 2026-11-09

--------------------------------------------------------------------------------

## Overview

This design addresses intermittent blank view rendering, empty data states (0 cards, 0 rows), and browser navigation freezes in Skift. The root causes stem from Supabase Free-Tier cold starts, connection sleeping during inactivity, and blocking edge middleware session queries. 

The system implements a resilient multi-tier data access architecture:
1. An edge middleware fast-fail timeout guard preventing stalled page navigations.
2. A client-side Stale-While-Revalidate (SWR) cache layer partitioned strictly by authenticated user and restaurant branch (`[userId]:[locationId]`).
3. A global four-state connection lifecycle (`CONNECTED`, `DEGRADED_CACHED`, `RECONNECTING`, `OFFLINE_EMPTY`).
4. A non-intrusive sticky amber reconnection banner displaying the last sync timestamp with an automated jittered background health check probe.

## The Problem

When Skift runs on Supabase Free Tier, the database instance automatically sleeps after periods of inactivity. This triggers a cascade of failures:
1. **Edge Middleware Freeze**: [`middleware.ts`](file:///Users/charansriteja/Documents/scheduler/middleware.ts) invokes `await supabase.auth.getSession()` on every request. When Supabase is sleeping, this call hangs for 15–30 seconds before timing out or throwing, causing the browser's document navigation (`localhost:3000/`) to stall in status `pending`.
2. **Silent Empty Rendering**: Client components fetch directly using `@supabase/auth-helpers-nextjs`'s browser client. When connections drop or timeout, catch blocks in `lib/supabase/*` return empty arrays `[]`. The UI renders blank tables and 0 metric cards without indicating an error.
3. **Loss of Operational Context**: Quick-service restaurant staff rely on the schedule, shift logs, and task lists. Having the app silently show zero employees or zero scheduled shifts creates immediate operational confusion.

## Goals

*   **Zero Frozen Navigations**: Prevent Next.js edge middleware from blocking document requests during remote database sleep/cold starts with an explicit 1.5s timeout guard.
*   **Instant View Hydration**: Display cached data snapshots from `localStorage` within 20ms of page mount across primary operational views (`schedule`, `employees`, `tasks`, `inventory`, `sales`).
*   **Strict Multi-User & Location Isolation**: Partition all cached data by `userId`, `location_id`, and entity (`skift:cache:[userId]:[locationId]:[entity]`) to prevent cross-branch or cross-role data bleeding on shared terminals.
*   **Explicit Degraded Mode UI**: Display a non-intrusive amber banner indicating the data is cached (with timestamp) and that background reconnection is in progress.
*   **Automated Background Reconnection**: Health check endpoint (`/api/health`) with randomized exponential backoff polling (3s, 6s, 12s + jitter) to restore live status automatically once the database wakes up.

## Non-Goals

*   **Upgrading Supabase Cloud Tier**: The system must operate reliably on the Free Tier without requiring paid infrastructure upgrades.
*   **Full Offline Write Conflict Resolution (CRDTs)**: Writes attempted while the database is unreachable will not perform complex offline sync; they will fail gracefully with explicit toast notifications and preserve the user's input.
*   **Database Schema & RLS Alterations**: No changes to existing Supabase PostgreSQL schemas, relations, or Row Level Security policies.

## Critical User Journeys (CUJs)

### CUJ 1: Manager Opens Schedule During Database Cold Start
*   **Given**: The Supabase Free-Tier database has been sleeping for 6 hours; the manager previously loaded the week's schedule yesterday.
*   **When**: The manager navigates to `/schedule`.
*   **Then**: 
    1. Edge middleware completes within 1.5s (failing open if `getSession()` exceeds timeout).
    2. The `/schedule` page mounts and immediately renders the cached schedule snapshot from `localStorage` within 20ms.
    3. An amber banner appears at the top: *"Showing cached data (updated yesterday at 18:30) — Reconnecting to database..."* with a *"Retry Now"* button.
    4. The background health check pings `/api/health`. Once Supabase finishes warming up, the page silently revalidates with fresh data and transitions to `CONNECTED` (banner dismisses).

### CUJ 2: Staff Member Switches Restaurant Branch While Degraded
*   **Given**: The application is in `DEGRADED_CACHED` mode.
*   **When**: The regional manager switches from "Stockholm Central" to "Uppsala" in the branch switcher.
*   **Then**: 
    1. The cache engine queries the key `skift:cache:[userId]:[uppsala_id]:schedule`.
    2. If Uppsala has cached data, it renders Uppsala's cached snapshot with Uppsala's sync timestamp.
    3. If Uppsala has no cached data, it displays an explicit empty recovery card: *"No cached data available for Uppsala — Reconnecting to database..."* rather than showing Stockholm Central's cached staff.

### CUJ 3: Action Execution During Degraded Mode
*   **Given**: The application is displaying cached data in `DEGRADED_CACHED` mode.
*   **When**: A shift leader clicks "Add Shift" or submits an attendance punch.
*   **Then**: 
    1. The write operation detects that the live database connection is currently unavailable.
    2. An informative toast / dialog alerts the user: *"Database is currently waking up. Please wait a moment before saving shifts."*
    3. The form state is preserved so the user does not lose their typed input.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### Architectural Overview

The resilient architecture decouples view rendering from synchronous remote database round-trips. It comprises four primary layers:

```text
[ Browser Navigation / Route Request ]
                 │
                 ▼
     ┌───────────────────────┐
     │  Next.js Edge         │   Fast-Fail Timeout (1.5s)
     │  middleware.ts        │──► If timeout/error, fails open to page shell
     └───────────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │  Page / View Shell    │
     │  (e.g., /schedule)    │
     └───────────────────────┘
                 │
                 ├──► 1. Instant Cache Hydration (0-20ms)
                 │    ┌──────────────────────────────────────────────┐
                 │    │ Client SWR Engine (localStorage + memory)    │
                 │    │ Key: `skift:cache:[userId]:[locationId]:...` │
                 │    └──────────────────────────────────────────────┘
                 │
                 └──► 2. Revalidation Query (AbortTimeout: 3.5s)
                      ┌──────────────────────────────────────────────┐
                      │ Database Client / API Route Handler          │
                      │ (Supabase Free Tier Postgres)                │
                      └──────────────────────────────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  [ 200 OK / Fresh ]        [ Timeout / Error ]
                         │                         │
                  Update cache & set        Retain cached view, set
                  state = CONNECTED         state = DEGRADED_CACHED
                                                   │
                                                   ▼
                                            Mount Sticky Banner &
                                            poll /api/health (jittered)
```

### Component Breakdown

#### 1. Edge Middleware Timeout Guard (`middleware.ts`)
- **Problem Solved**: Eliminates browser navigation hanging on status `pending` while strictly maintaining zero-trust authentication on protected routes.
- **Implementation Mechanism**:
  1. Inspect the incoming request cookies for Supabase auth tokens (`sb-access-token` / project auth cookie).
  2. If an unauthenticated user attempts to access protected routes (`/schedule`, `/employees`, `/sales`, etc.), redirect immediately to `/login` without attempting any remote Supabase query.
  3. For requests with existing session cookies, pass an explicit `AbortSignal.timeout(1500)` into the auth client call to ensure underlying TCP sockets are aborted immediately on timeout.
  4. If a timeout occurs on a request holding a session cookie, allow the request to proceed to the client shell. The client-side `AuthContext` will verify JWT validity locally or redirect to login.

#### 2. Universal SWR Cache Engine (`lib/cache/swr-cache.ts`)
- **Contract & Hook Interface**:
  ```typescript
  interface CacheEntry<T> {
    data: T;
    timestamp: number; // Date.now()
    locationId: string;
    userId: string;
    version: number;
  }

  export function useCachedQuery<T>(
    key: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    options: {
      locationId: string;
      userId?: string;
      ttlMs?: number;       // Default: 10 minutes
      timeoutMs?: number;   // Default: 3,500ms
      isEditing?: boolean;  // Fencing: prevents view overwrite when editing
    }
  ): {
    data: T | undefined;
    isLoading: boolean;
    isCached: boolean;
    isDegraded: boolean;
    lastSync: number | null;
    error: Error | null;
    hasStagedUpdate: boolean;
    applyStagedUpdate: () => void;
    refetch: () => Promise<void>;
  };
  ```
- **Lifecycle Sequence**:
  1. **Zero-Mismatch Hydration**: Use `useSyncExternalStore` with `getSnapshot` reading from `localStorage` under `skift:cache:[userId]:[locationId]:[entityKey]` and `getServerSnapshot: () => undefined`.
  2. **Single-Flight Deduplication**: In-flight promises are pooled to prevent concurrent component mounts from firing duplicate remote queries.
  3. **Background Network Revalidation**: Execute `fetcher` with `AbortSignal.timeout(options.timeoutMs ?? 3500)`.
  4. **Error Differentiation**:
     - HTTP 401 / 403: Pass to auth error handler (triggers session refresh / login redirect).
     - `AbortError` / Network Timeout / 503 / 504: Retain cached snapshot, transition state to `DEGRADED_CACHED`.
  5. **Edit Fencing**: If `isEditing` is true when fresh network data arrives, do not overwrite active form state; flag `hasStagedUpdate = true` and present an *"Updates available — [Update View]"* pill.
  6. **Storage Quota & Eviction**: Enforce an LRU cache eviction strategy capping storage at 3MB to prevent browser storage exhaustion.

#### 3. Global Connection State & Status Context (`context/DatabaseStatusContext.tsx`)
- **States Managed**:
  - `CONNECTED`: Remote Supabase database is responding normally.
  - `DEGRADED_CACHED`: Remote queries timed out or failed; cached data is being displayed.
  - `RECONNECTING`: Actively probing `/api/health`.
  - `OFFLINE_EMPTY`: Queries failed and no local cache exists for the current location.
- **Provider API**:
  ```typescript
  interface DatabaseStatusValue {
    state: ConnectionState;
    lastSyncTime: number | null;
    isDegraded: boolean;
    setDegraded: (timestamp: number) => void;
    setConnected: () => void;
    retryNow: () => Promise<void>;
    clearUserCache: (userId: string) => void;
  }
  ```

#### 4. Non-Intrusive Reconnection Banner (`components/reconnection-banner.tsx`)
- **Placement**: Mounted at the top of `components/app-shell.tsx` directly under the top navigation bar.
- **Visual Design**: Warm amber bar (`bg-[#FFF8E6] border-[#F0D5A8] text-[#8C5E1E]`) matching the Skift warm earth palette.
- **Content by State**:
  - `DEGRADED_CACHED`: Pulsing amber indicator + *"Showing cached data (synced {timeAgo}) — Reconnecting to database..."* + *"Retry Now"* button.
  - `OFFLINE_EMPTY`: Neutral pulsing indicator + *"Connecting to database — No local cache for this branch. [Retry Now]"*.
  - `RECONNECTING`: Spinning indicator + *"Re-establishing connection..."*.

#### 5. Background Health Check & Debounced Wakeup Endpoint (`app/api/health/route.ts`)
- **Endpoint**: `/api/health` queries `.from('locations').select('id').limit(1)` using `serviceClient()` with a 3,000ms timeout.
- **Server-Side Circuit Breaker**: Results are cached in server memory for 5 seconds to prevent thundering-herd database connection exhaustion from multiple polling client tabs.
- **Polling Strategy**: When `state !== 'CONNECTED'`, poll `/api/health` with jittered exponential backoff:
  $$\text{interval} = \min(30000, 3000 \times 2^{\text{attempt}}) + \text{random}(0, 1000)\text{ ms}$$
- **Proactive Wakeup Beacon**: On initial page load or window focus, fire `fetch("/api/health", { keepalive: true })` throttled to maximum once every 60 seconds.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Server-Side Global In-Memory Fallback (`runtime-store.ts`)
*   **Mechanism**: Maintain an in-memory replica on the Next.js server (`globalThis.__SKIFT_RUNTIME_STORE__`) and query it when Supabase queries fail on the server.
*   **Pros**: Centralized cache on the server side; no client-side localStorage management needed.
*   **Cons**: Ephemeral container lifecycles in serverless environments (Next.js route handlers spin up isolated lambdas); global state does not persist across separate lambda invocations; increases server RAM footprint.
*   **Reason for Rejection**: Rejected by author: Serverless execution makes `globalThis` cache unreliable in production deployment environments. Client-side SWR caching directly inside the user's browser provides 100% guarantee of data persistence across network drops and tab reloads.

### Alternative B: Direct Client-Side Fetching Without Timeout Guards
*   **Mechanism**: Continue querying Supabase directly from browser components without AbortController timeouts or edge middleware guards, adding generic try-catch error alerts.
*   **Pros**: No additional cache or timeout abstraction layers needed.
*   **Cons**: Browser requests hang indefinitely (15-30s) during cold starts; browser HTTP connection pool exhaustion; UI renders blank 0-row cards when errors occur.
*   **Reason for Rejection**: Rejected by author: This is the exact root cause of the current failure mode.

### Alternative C: Full Offline Database Replication via IndexedDB & CRDTs
*   **Mechanism**: Mirror the entire Supabase database into browser IndexedDB with Conflict-free Replicated Data Types (CRDTs) to enable full offline writes and automatic background synchronization.
*   **Pros**: Full offline write capabilities even during prolonged internet outages.
*   **Cons**: Substantial architectural complexity; merge conflict risks with shift schedules and payroll hours; massive code footprint.
*   **Reason for Rejection**: Rejected by author: Over-engineered for an internal restaurant scheduler addressing Supabase Free-Tier sleeping. Local snapshot caching and fast-fail reconnection satisfy all operational requirements without synchronization risk.

--------------------------------------------------------------------------------

## Non-Functional Requirements

### Performance & Latency
*   **Initial Render Latency**: View hydration from `localStorage` must complete in $\le 20\text{ ms}$ upon component mount.
*   **Fast-Fail Edge Guard**: Edge middleware timeout must abort within $1,500\text{ ms}$ to guarantee browser navigation never stalls.
*   **Query Abort Threshold**: Remote database queries must abort within $3,500\text{ ms}$ to trigger degraded cache mode immediately without browser freeze.

### Security & Privacy
*   **Multi-Branch & User Data Segregation**: Cache keys must strictly incorporate `userId` and `locationId` (`skift:cache:[userId]:[locationId]:[entity]`). A user switching locations or accounts on shared devices must never see cached shift or payroll data belonging to another user or store branch.
*   **No PII in Shared Storage**: Storage is local to the user's browser profile; token verification remains enforced via HTTP-only session cookies.

### Reliability & Recovery
*   **Automatic Self-Healing**: Once Supabase wakes up, the background health poll must detect recovery within one polling cycle ($\le 10\text{ s}$) and seamlessly revalidate active views without requiring a page reload.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `middleware.ts` (Modify)
*   **Type / Scope**: Next.js Edge Middleware
*   **Proposed Changes**:
    - Inspect request cookies for Supabase auth tokens (`sb-access-token` / project cookie).
    - Retain the inverted protection whitelist: if no auth session token is present on any route *except* explicit public routes (`/login`, `/signup`, `/welcome`, `/auth/*`, `/reset-password`, `/punch`), immediately return `NextResponse.redirect(new URL("/login", req.url))` without attempting any remote Supabase query.
    - For requests with existing session cookies, configure `createServerClient` with a custom global fetch wrapper:
      `global: { fetch: (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(1500) }) }`.
    - Catch timeouts gracefully: if a session cookie exists and the remote check times out, log a structured warning and return `NextResponse.next()` to fail open to the client shell where JWT claims are verified locally.
*   **Rationale**: Eliminates browser navigation hanging on status `pending` while closing the security loophole on unauthenticated requests and preventing edge socket pool exhaustion.

#### 2. `lib/cache/swr-cache.ts` (Create)
*   **Type / Scope**: Core Client Cache Utility
*   **Proposed Changes**:
    - Export `useCachedQuery<T>(key, fetcher, options)`.
    - Implement zero-mismatch initial state hydration using React 19's `useSyncExternalStore` with `getSnapshot` reading from `localStorage` under `skift:cache:[userId]:[locationId]:[entityKey]` and `getServerSnapshot: () => undefined`.
    - Return object signature: `{ data, isLoading, isCached, isDegraded, lastSync, error, hasStagedUpdate, applyStagedUpdate, refetch }`.
    - Provide in-memory in-flight promise map to deduplicate identical concurrent queries across sibling components.
    - Implement background revalidation with `AbortSignal.timeout(options.timeoutMs ?? 3500)`.
    - Differentiate errors: HTTP 401/403 bubble to `AuthContext`; transient timeouts / network aborts set `isDegraded = true` and keep cached snapshot.
    - Implement edit fencing: if `options.isEditing` is true, stage incoming updates in `stagedData` and expose `hasStagedUpdate: boolean` with `applyStagedUpdate()`.
    - Implement LRU cache eviction capping total `skift:cache:*` storage at 3MB to prevent browser `QuotaExceededError`.
    - Export `clearUserCache(userId: string)` for complete cache purge on logout.
*   **Rationale**: Serves instant cached snapshots within 20ms without SSR hydration mismatch, prevents destructive view overwrites during user edits, and ensures complete multi-user isolation on shared terminals.

#### 3. `context/DatabaseStatusContext.tsx` (Create)
*   **Type / Scope**: React Client Context Provider
*   **Proposed Changes**:
    - Manage states: `'CONNECTED' | 'DEGRADED_CACHED' | 'RECONNECTING' | 'OFFLINE_EMPTY'`.
    - Store `lastSyncTime: number | null` and `activeLocationId: string`.
    - Provide `setDegraded(timestamp: number)` and `setConnected()`.
    - Implement jittered exponential backoff polling mechanism targeting `/api/health` whenever `state !== 'CONNECTED'`.
    - Expose `retryNow()` triggering an immediate force-ping.
    - Wire `clearUserCache` to the provider and hook into `useAuth().signOut`.
*   **Rationale**: Coordinates application-wide connectivity state and manages the automatic background reconnection cycle.

#### 4. `context/AuthContext.tsx` (Modify)
*   **Type / Scope**: Authentication Context
*   **Proposed Changes**:
    - Import `clearUserCache` from `lib/cache/swr-cache`.
    - In `signOut()`, invoke `clearUserCache(user.id)` prior to navigating to `/login` to purge cached store and employee records from the shared device.
*   **Rationale**: Prevents cross-user data bleeding when employees alternate logins on shared back-office terminals.

#### 5. `components/reconnection-banner.tsx` (Create)
*   **Type / Scope**: Presentation UI Component
*   **Proposed Changes**:
    - Render a sticky top bar whenever `state !== 'CONNECTED'`:
      - `DEGRADED_CACHED`: Amber bar with pulsing badge + *"Showing cached data (synced {timeAgo}) — Reconnecting to database..."* + *"Retry Now"* button.
      - `OFFLINE_EMPTY`: Neutral pulsing bar + *"Connecting to database — No local cache for this branch. [Retry Now]"*.
      - `RECONNECTING`: Spinning indicator + *"Re-establishing connection..."*.
    - Render an edit-fencing pill if `hasStagedUpdate` is true: *"Updates available — [Update View]"*.
    - Provide a subtle slide-down entrance animation and clean dismiss when `CONNECTED`.
*   **Rationale**: Informs the user transparently across all degraded states without obstructing critical restaurant workflows.

#### 6. `app/api/health/route.ts` (Create)
*   **Type / Scope**: Next.js Serverless Route Handler
*   **Proposed Changes**:
    - Handle `GET` requests.
    - Perform a lightweight query: `.from('locations').select('id').limit(1).abortSignal(AbortSignal.timeout(3000))` using `supabaseClient` (falling back to `serviceClient()` if available, or returning 200 `{ status: 'mock' }` if Supabase keys are unconfigured in dev).
    - Implement a 5-second server-side in-memory circuit breaker cache: return the cached health status if probed within 5 seconds to prevent thundering-herd connection exhaustion on Supabase wake-up.
    - Return `NextResponse.json({ status: 'ok', timestamp: Date.now() })` on success (HTTP 200).
    - Return `NextResponse.json({ status: 'degraded', error: message }, { status: 503 })` on failure.
*   **Rationale**: Provides a lightweight, thundering-herd-protected probe endpoint for client reconnection polling.

#### 7. `components/app-shell.tsx` (Modify)
*   **Type / Scope**: Primary Application Shell
*   **Proposed Changes**:
    - Wrap the shell layout with `DatabaseStatusProvider`.
    - Mount `<ReconnectionBanner />` at the top of the main page container above view content.
    - Refactor `getEmployees`, `getTasks`, and `getChannels` to consume `useCachedQuery`.
    - Add window focus event listener with a 60s throttle to fire proactive health check beacon.
*   **Rationale**: Guarantees the reconnection banner is visible across all dashboard pages and prevents the navigation shell from rendering blank employee lists.

#### 8. `app/(dashboard)/page.tsx` & `app/(dashboard)/schedule/page.tsx` (Modify)
*   **Type / Scope**: Core Dashboard & Schedule Views
*   **Proposed Changes**:
    - In `app/(dashboard)/page.tsx`, refactor `getShiftsByWeek`, `getTasks`, `getSales`, `getAlerts`, and `getActivity` to consume `useCachedQuery`.
    - In `app/(dashboard)/schedule/page.tsx`, hoist edit state: declare `const [isShiftEditing, setIsShiftEditing] = useState(false)` in `SchedulePageContent`, passed down to `ShiftPopover` / shift dialogs.
    - Pass `isEditing = isShiftEditing` to `useCachedQuery` for shifts.
    - Mount the staged update pill if `hasStagedUpdate` is true to allow the user to refresh the view on demand.
*   **Rationale**: Eliminates the 0-row blank rendering on primary pages while protecting open edit forms from destructive background data overwrites using concrete hoisted state.

#### 9. `lib/supabase/*` Access Modules (`shifts.ts`, `employees.ts`, `tasks.ts`, `sales.ts`, `chat.ts`, `alerts.ts`, `activity.ts`) (Modify)
*   **Type / Scope**: Database Access Layer
*   **Proposed Changes**:
    - Remove direct imports of `getRuntimeStore` from server runtime store inside client-accessible query functions.
    - Remove silent empty array fallbacks on error (e.g. `catch { return []; }`) across `tasks.ts`, `sales.ts`, `chat.ts`, `alerts.ts`, and `activity.ts`.
    - Standardize error bubbling via `normalizeSupabaseError` so network timeouts trigger `useCachedQuery`'s degraded cache mode rather than overwriting cache with empty arrays.
    - Export clean query functions that accept an optional `AbortSignal`.
*   **Rationale**: Prevents client bundle pollution and ensures errors propagate properly to the SWR cache fallback layer across all application views.

### Verification Plan

*   **Compilation & Build**:
    - Run: `npm run lint` — Verify zero ESLint errors or type warnings across new/modified modules.
    - Run: `npm run build` — Verify Next.js production build succeeds, edge middleware compiles within budget, and client bundles contain no server-only leaks.
*   **Unit & Functional Verification**:
    1. **Cold Start Simulation**: Artificially block or delay Supabase network responses (e.g. by setting an unreachable URL or 10s latency). Verify:
       - Navigating to `/` or `/schedule` loads in $<100\text{ ms}$ without browser status `pending`.
       - Previously viewed shifts and employees appear immediately with a timestamp.
       - Amber banner displays: *"Showing cached data (updated X minutes ago) — Reconnecting to database..."*.
    2. **Branch Switching Test**: Switch from Location A to Location B while in degraded mode. Verify Location A's cache does not leak into Location B.
    3. **Auto-Recovery Test**: Restore Supabase connectivity. Verify background poll hits `/api/health`, detects HTTP 200, revalidates fresh data, and smoothly hides the reconnection banner without page reload.

--------------------------------------------------------------------------------

*Drafted with EGM*

# Distributed Latency Resolution & AWS Native Migration

*   **Author:** Charan Sri Teja
*   **Status:** Approved
*   **Date:** 2026-11-10

--------------------------------------------------------------------------------

## Overview

This design establishes a two-phase architecture to achieve a strict sub-second ($\le 1.0\text{ s}$) Largest Contentful Paint (LCP) and page load time for the Skift employee scheduling application across geographically dispersed users in Sweden (Stockholm) and India (Mumbai).

The design addresses latency through two staged phases:
1. **Phase 1 (Immediate In-Code Latency Resolution):** Eliminates remote authentication round-trips from Next.js Edge middleware via local cryptographic JWT verification; converts the root dashboard into an async React Server Component (RSC) wrapper that aggregates data into a single server-side snapshot; and pre-hydrates the client SWR memory cache on initial page mount. This is the primary deliverable for current production sign-off, achieving sub-second LCP for $0/month on existing infrastructure.
2. **Phase 2 (AWS Native Infrastructure Blueprint):** Establishes the long-term AWS native migration roadmap using available AWS promotional credits through February 2027. Blueprints containerized Next.js 16 on AWS App Runner fronted by AWS CloudFront edge points of presence (POPs) in Mumbai and Stockholm, connecting to an Amazon RDS PostgreSQL database (`db.t4g.micro`) with connection pooling and a lightweight NAT instance (`fck-nat`), maintaining an ongoing baseline cost of ~$20–$25/month.

## The Problem

In the current architecture, users in Sweden and India experience compounding latency (2.8s–4.5s load times in India; 1.4s–2.2s in Sweden) caused by three architectural bottlenecks:
1. **The Edge Middleware Network Penalty**: In [`middleware.ts`](file:///Users/charansriteja/Documents/scheduler/middleware.ts#L74-L88), every single incoming document request awaits `supabase.auth.getSession()` over the network, bounded by a 1,500ms timeout. For users in India accessing a database in Ireland (`eu-west-1`), this cross-continental HTTPS call to Supabase GoTrue (the underlying authentication microservice) adds 180ms–800ms before the browser receives a single byte of HTML.
2. **The 8-Query Client Waterfall**: Upon page load, `components/app-shell.tsx` and `app/(dashboard)/page.tsx` independently trigger 8 unbundled browser-side Supabase PostgREST queries (`getEmployees`, `getTasks`, `getChannels`, `getShiftsByWeek`, `getSales`, `getAlerts`, `getActivity`). Across high-latency intercontinental connections (150ms+ RTT), these sequential/parallel requests saturate browser connection limits and delay data readiness by 1,200ms–2,500ms.
3. **The Inactivity Cold Sleep**: The Supabase free tier pauses or scales down compute during periods of developer inactivity (1–2 days), causing initial queries to hang for 10–30 seconds while the database spins up.

## Goals

*   **Sub-Second LCP Guarantee ($\le 1.0\text{ s}$)**: Achieve $\le 1.0\text{ s}$ Largest Contentful Paint for authenticated dashboard loads from both Sweden (Stockholm, target $\le 450\text{ ms}$) and India (Mumbai, target $\le 850\text{ ms}$).
*   **Zero-Network Middleware Auth Check ($< 5\text{ ms}$)**: Verify JWT tokens locally in Edge middleware using cryptographic signature and expiration verification without remote network calls.
*   **Single-Flight Initial Data Delivery (0 Client Round-Trips)**: Aggregate initial dashboard data on the server during SSR, rendering populated HTML with zero subsequent client-side data requests on initial paint.
*   **Instant Cached Tab Transitions**: Pre-hydrate client SWR memory cache and freshness timestamps on initial page load, enabling instantaneous ($< 50\text{ ms}$) subsequent view switching with zero skeleton flicker.
*   **Elimination of Inactivity Cold Starts**: Deploy a secured, lightweight keep-alive mechanism to prevent development database sleeping.
*   **Cost-Capped Native AWS Blueprint**: Define a production-ready AWS native deployment (App Runner + RDS PostgreSQL + CloudFront + NAT) running at ~$20–$25/month, fully covered by credits through February 2027.

## Non-Goals

*   **Immediate Auth.js Rewrite in Phase 1**: Decouple replacing Supabase Auth with Auth.js from performance optimization. Replacing auth dismantles existing PostgreSQL Row-Level Security (RLS) policies relying on `auth.uid()`, adds zero latency benefit, and introduces unnecessary migration risk during demo preparation.
*   **Multi-Master Active-Active Database Clustering**: No multi-region distributed database replication across Europe and India (prohibitive baseline cost of >$200/month and operational complexity).
*   **Standalone Microservice Backend**: No standalone Express, Fastify, or Go microservice. Next.js 16 App Router handles server actions, SSR, and API routing within a single container.

## Open Questions

*   **Question 1 (Sliding-Window Token Refresh Protocol)**: To prevent Refresh Token Rotation (RTR) lockouts when multiple tabs are open, sliding-window session refresh is executed server-side during SSR / Server Actions when a token has $< 2$ minutes remaining, returning updated session cookies in response headers. Client-side fallback refreshes are fenced using the Web Locks API (`navigator.locks.request("auth-refresh")`).

## Critical User Journeys (CUJs)

### CUJ 1: Shift Supervisor in Mumbai Loads Dashboard Cold ($\le 1.0\text{ s}$ LCP)
*   **Given**: A shift supervisor in Mumbai opens the Skift dashboard on a 4G or fiber connection accessing servers in Europe.
*   **When**: The supervisor navigates to `/`.
*   **Then**: 
    1. Edge middleware validates the user's JWT cookie locally in $< 5\text{ ms}$ with zero network calls.
    2. The React Server Component (RSC) wrapper executes `getDashboardSnapshot` on the server co-located with the database, compiling core dashboard widgets (shifts, tasks, employees, sales, alerts) via `Promise.allSettled`.
    3. The HTML document streams to Mumbai with pre-rendered data; client SWR memory cache is pre-seeded before child components mount.
    4. The dashboard renders fully populated within $\le 850\text{ ms}$ without layout shifts or skeleton pop-in, initiating zero client-side HTTP data requests on mount.

### CUJ 2: Store Manager in Stockholm Switches Operational Tabs (Zero Waterfall)
*   **Given**: A manager in Stockholm is on `/` and clicks "Schedule" or "Tasks" in the sidebar.
*   **When**: The route transition occurs.
*   **Then**: 
    1. Navigation progress bar renders an active transition indicator with zero visual stutter ($< 16\text{ ms}$).
    2. SWR cache immediately serves the pre-cached view data in $< 50\text{ ms}$.
    3. Background revalidation fires quietly without freezing the UI or blanking cards.

### CUJ 3: Developer Returns to App After 2 Days of Inactivity (No Cold Hang)
*   **Given**: No developer has accessed the development or demo environment for 48 hours.
*   **When**: A developer or prospective client opens the demo link.
*   **Then**: 
    1. The database connection is active and warm due to automated background keep-alive probes.
    2. The page loads within normal latency thresholds ($\le 1.0\text{ s}$), completely avoiding the 10–30s Supabase waking hang.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### Architectural Overview

The latency resolution architecture coordinates a two-phase optimization model:

```text
========================================================================================
CURRENT ARCHITECTURE (Compounding Latency: 2.8s–4.5s in India, 1.4s–2.2s in Sweden)
========================================================================================
Browser (India/Sweden) ──[ Document Request ]──► Vercel Edge Middleware
                                                        │
                                                        ▼ (Remote HTTPS Call: 180–800ms)
                                                  Supabase GoTrue (Ireland)
                                                        │
                                                        ▼
Browser ◄──[ HTML & JS Bundles ]────────────────────────┘
   │
   ├──► [ Query 1: getEmployees ] ──┐
   ├──► [ Query 2: getTasks ]     ──┤
   ├──► [ Query 3: getChannels ]  ──┤ (8 unbundled client round-trips over 150ms+ RTT)
   ├──► [ Query 4: getShifts ]    ──┤ ──► Direct PostgREST HTTPS calls (Ireland)
   ├──► [ Query 5: getSales ]     ──┤     (1,200ms–2,500ms data wait time)
   ├──► [ Query 6: getAlerts ]    ──┤
   └──► [ Query 7: getActivity ]  ──┘

========================================================================================
PHASE 1 ARCHITECTURE: IN-CODE LATENCY RESOLUTION (Passes <= 1.0s LCP Budget)
========================================================================================
Browser (India/Sweden) ──[ Document Request ]──► Next.js Edge Middleware
                                                        │
                                                        ▼ (<2ms Local Crypto Verification)
                                                  `jose` jwtVerify(token, Uint8Array)
                                                        │
                                                        ▼ (0ms remote auth delay)
                                                  app/(dashboard)/page.tsx (RSC Wrapper)
                                                        │
                                                        ▼ (1 server-to-DB internal query)
                                                  Supabase Postgres (Promise.allSettled)
                                                        │
                                                        ▼ (Inlined initial data)
Browser ◄──[ Pre-rendered HTML + Embedded Snapshot ]────┘
   │
   └──► React Mount: `<DashboardClient initialSnapshot={snapshot} />`
        • `hydrateCache()` synchronously seeds memoryCache & lastFetchTimeByKey
        • Zero client-side network round-trips on initial paint
        • LCP achieved in 350–450ms (Sweden) and 650–850ms (India)

========================================================================================
PHASE 2 ARCHITECTURE: AWS NATIVE INFRASTRUCTURE (~$20–$25/mo via Credits)
========================================================================================
Browser (India/Sweden)
   │
   ▼ (Local Edge Termination: <35ms in Mumbai/Delhi/Stockholm)
[ AWS CloudFront CDN (Global Edge POPs) ]
   ├── Static Assets (/_next/static/*) ──► Cached in Edge RAM (<15ms)
   └── Dynamic Document & API Requests
           │
           ▼ (Persistent Keep-Alive Connection)
[ AWS App Runner (Next.js 16 Standalone Container, eu-west-1 / eu-north-1) ]
   │  • Provisioned 0.5 vCPU, 1 GB RAM (Always warm, zero cold start)
   │  • In-container Auth.js session management (long-term roadmap)
   │
   ├──► Outbound Internet (OpenAI API, webhooks) ──► fck-nat instance ($3.20/mo)
   │
   ▼ (VPC Connector: <1ms private transit, PgBouncer pool max: 10)
[ Amazon RDS PostgreSQL (db.t4g.micro, Single-AZ, 20 GB gp3) ]
```

### Component Breakdown

#### 1. Zero-Network Middleware Cryptographic JWT Verification (`middleware.ts`)
*   **The Problem Addressed**: Replacing the blocking `await supabase.auth.getSession()` call that hangs for up to 1.5s on slow links.
*   **Implementation Mechanism**:
    - Extract session cookie: Scan request cookies for base key `sb-<project-ref>-auth-token` or chunked cookies (`.0`, `.1`). Concatenate chunks and safely parse JSON array (`["<access_token>","<refresh_token>"]`) or JSON object to isolate the raw JWT string.
    - Cryptographic Verification: Use `jose.jwtVerify(token, new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!))` with HMAC SHA-256 (`HS256`) in Edge runtime.
    - Expiration Check: Validate signature and `exp` claim. Wrap in `try/catch` to handle `errors.JWTExpired` and malformed tokens cleanly.
    - Routing Logic:
      - If valid and on auth pages (`/login`, `/signup`): redirect to `/`.
      - If valid on protected route: forward immediately via `NextResponse.next()` ($< 2\text{ ms}$, 0 network calls).
      - If invalid/missing on protected route: redirect to `/login`.
    - Sliding-Window Refresh: When token has $< 2$ minutes remaining, allow request to pass to server components; the server component refreshes the session via Supabase GoTrue and appends `Set-Cookie` headers to the outgoing response. Client-side fallback refreshes are locked with `navigator.locks.request("auth-refresh")` to prevent RTR lockout.
    - Security Note: Acknowledge that local JWT verification allows valid tokens to access routes until `exp` (standard 60-min window). Immediate administrative revocations are enforced on sensitive write actions via database user metadata checks.

#### 2. Consolidated Server Data Snapshot Service (`lib/services/dashboard-snapshot.ts`)
*   **The Problem Addressed**: Eliminating the 8 unbundled browser-side PostgREST requests that create 1.2s–2.5s waterfalls across intercontinental links.
*   **Implementation Mechanism**:
    - Instantiation: Initialize a server-scoped Supabase client using `createServerComponentClient({ cookies })` from `@supabase/auth-helpers-nextjs` to forward authentication cookies and preserve PostgreSQL Row-Level Security (RLS) policies.
    - Fault-Tolerant Aggregation: Execute queries in parallel using `Promise.allSettled`:
      ```typescript
      export interface DashboardSnapshot {
        employees: Employee[];
        schedule: WeekSchedule; // Contains shifts: Shift[], weekStart, locationId, status
        tasks: Task[];
        channels: ChatChannel[];
        sales: SalesDay[];
        alerts: DashboardAlert[];
        activity: EmployeeActivityItem[];
        timestamp: string;
        degraded?: boolean;
      }
      ```
    - Degraded Mode Fallback: Core operational data (`schedule`, `tasks`, `employees`) are mandatory. If auxiliary telemetry (`sales`, `alerts`, `activity`) times out or fails, default to empty arrays and mark `{ degraded: true }` without throwing a 500 error.
    - Revalidation Route: Expose `/api/dashboard/snapshot` as a `GET` route handler reserved strictly for periodic background revalidation and manual user refresh.

#### 3. Client SWR Cache Pre-Hydration & Instant Transition Layer (`lib/cache/swr-cache.ts`)
*   **The Problem Addressed**: Asynchronous skeleton churn and delayed tab transitions when users navigate between views.
*   **Implementation Mechanism**:
    - Atomic Hydration:
      ```typescript
      export function hydrateCache(
        entries: Record<string, any>,
        meta?: { locationId?: string; userId?: string }
      ): void {
        const now = Date.now();
        Object.entries(entries).forEach(([key, value]) => {
          setCacheEntry(key, value, meta);
          lastFetchTimeByKey.set(key, now);
        });
      }
      ```
    - Mount Revalidation Fencing: Update `useCachedQuery` to recognize primed cache data as fresh (`Date.now() - lastFetchTime < 60000`), suppressing redundant mount fetches.
    - Skeleton Elimination: Support initializing `isHydrated` to `true` when cache is primed, allowing `<DashboardClient>` to render synchronously in initial paint with zero Layout Shift ($\text{CLS} < 0.05$).
    - Key Mapping:
      - `snapshot.employees` $\rightarrow$ `"employees"`
      - `snapshot.schedule` $\rightarrow$ `"shifts:week:${weekStartStr}"` (as `WeekSchedule`)
      - `snapshot.tasks` $\rightarrow$ `"tasks:dashboard"` and `taskKey` (`tasks:my:${employeeId}` / `tasks:all`)
      - `snapshot.channels` $\rightarrow$ `"channels"`
      - `snapshot.sales` $\rightarrow$ `"sales:today"`
      - `snapshot.alerts` $\rightarrow$ `"alerts:dashboard"`
      - `snapshot.activity` $\rightarrow$ `"activity:dashboard"`

#### 4. Development Database Keep-Alive Daemon (`app/api/health/ping/route.ts`)
*   **The Problem Addressed**: The 10–30 second cold-start delay when developers or prospective clients open the app after 1–2 days of inactivity.
*   **Implementation Mechanism**:
    - Authenticated Ping: Require `Authorization: Bearer ${CRON_SECRET}` on incoming requests; reject unauthenticated calls with HTTP 401.
    - Grounded Database Probe: Execute a minimal query using `.from("locations").select("id").limit(1)` via Supabase client.
    - Rate Limiting: Enforce an edge rate limiter allowing at most 1 request per 5 minutes to prevent connection pool exhaustion attacks.
    - Scheduled Trigger: Run every 6 hours via GitHub Actions (`.github/workflows/db-keepalive.yml`) parameterized with `${{ secrets.APP_URL }}` and `${{ secrets.CRON_SECRET }}`.

#### 5. Phase 2: Native AWS Architecture Blueprint (Covered by Credits)
*   **Compute (AWS App Runner)**:
    - Containerized Next.js 16 runtime built using `output: "standalone"`.
    - Multi-stage Dockerfile explicitly copying `.next/static` to `.next/standalone/.next/static` and `public/` to `.next/standalone/public`.
    - Deployed in `eu-west-1` (Ireland) or `eu-north-1` (Stockholm). Sized at 0.5 vCPU and 1 GB RAM (provisioned concurrency = 1). Baseline cost: ~$6.40–$8.00/month.
*   **Database (Amazon RDS PostgreSQL)**:
    - PostgreSQL 16 on `db.t4g.micro` (2 vCPU, 1 GB RAM, 20 GB gp3 SSD storage).
    - Connection Pooling: Use PgBouncer in transaction mode or configure PostgreSQL parameter group with `max_connections = 25` and `work_mem = 4MB` to prevent 1 GB RAM OOM crashes under App Runner autoscaling. Baseline cost: ~$14.00/month.
    - Disaster Recovery: Single-AZ configuration with 7-day automated snapshot retention (RPO: 24h, RTO: 1–2h manual restore). Budget $1.00–$2.00/month for snapshot storage.
*   **VPC Egress Architecture**:
    - To avoid AWS's $32/mo managed NAT Gateway while allowing App Runner to access private RDS and external APIs (OpenAI API, webhooks), deploy a lightweight `fck-nat` container instance on `t4g.nano` (~$3.20/month) within the VPC public subnet. Total Phase 2 baseline: ~$24–$27/month (covered by credits).
*   **Edge Delivery (AWS CloudFront)**:
    - Points of presence (POPs) in Stockholm, Mumbai, Delhi, Chennai, and Frankfurt.
    - Terminates TLS handshakes at the edge ($< 35\text{ ms}$ in India instead of 180ms+).
    - Configure CloudFront Origin Shield in `eu-west-1` with TCP connection reuse to App Runner. Covered by AWS Free Tier (1 TB egress/month free).

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Immediate Full AWS Migration Without Codebase Fixes
*   **Mechanism**: Migrate the existing Next.js frontend and PostgreSQL database directly to AWS App Runner and Amazon RDS without refactoring middleware or client query waterfalls.
*   **Pros**: Consumes available AWS credits immediately; unifies cloud infrastructure under native AWS.
*   **Cons**: Completely fails to fix the latency floor. If 8 unbundled client queries continue to cross continents from India to Europe, each round-trip still takes 150ms+, resulting in 1.2s+ data fetch lag regardless of AWS hosting.
*   **Reason for Rejection**: Rejected by author: Moving un-optimized code to AWS does not fix the latency floor. Phase 1 in-code fixes are mandatory regardless of cloud host.

### Alternative B: AWS Lambda Serverless Next.js (OpenNext / SST)
*   **Mechanism**: Deploy Next.js serverless functions onto AWS Lambda behind AWS API Gateway and CloudFront.
*   **Pros**: True pay-per-request serverless scaling; scales to zero when completely inactive.
*   **Cons**: Lambda cold starts (500ms–2,000ms) on API Gateway and unpooled database connection handshakes exacerbate the exact intermittent latency issues observed by users.
*   **Reason for Rejection**: Rejected by author: Lambda cold starts and connection handshake penalties violate the strict $\le 1.0\text{ s}$ LCP budget. AWS App Runner provides persistent, warm container execution.

### Alternative C: Multi-Region Active-Active Aurora Global Database
*   **Mechanism**: Deploy write nodes in Europe and read replicas in India (`ap-south-1`).
*   **Pros**: Co-located database read nodes in both Europe and India for sub-5ms local query execution.
*   **Cons**: Minimum Aurora Global baseline cost exceeds $200–$300/month, completely blowing past the $20–$25/month target budget and prematurely draining the AWS credit pool.
*   **Reason for Rejection**: Rejected by author: The baseline cost is disproportionate for current development and demo scale. Edge TLS termination via CloudFront combined with server-side bootstrap hydration achieves sub-second LCP at $< 10\%$ of the cost.

### Alternative D: Immediate Full Rewrite to Auth.js in Phase 1
*   **Mechanism**: Remove Supabase Auth and migrate all authentication tables to Auth.js before addressing latency.
*   **Pros**: Completely eliminates dependency on Supabase authentication services upfront.
*   **Cons**: Dismantles all PostgreSQL Row-Level Security (RLS) policies relying on `auth.uid()`, requires custom user/session tables and password migration, adds zero latency benefit, and delays immediate performance improvements needed for upcoming demos.
*   **Reason for Rejection**: Rejected by author: Decoupling auth migration from performance fixes ensures immediate latency relief with zero risk to data security policies.

--------------------------------------------------------------------------------

## Non-Functional Requirements

### Performance & Latency Budgets
*   **Largest Contentful Paint (LCP)**: $\le 850\text{ ms}$ for users in India; $\le 450\text{ ms}$ for users in Sweden under 4G/fiber connections.
*   **Middleware Overhead**: $< 5\text{ ms}$ total execution time per request (cryptographic local verification with 0 network calls).
*   **SWR Cache Retrieval**: $< 16\text{ ms}$ (synchronous in-memory lookup on warm route transitions).

### Security & Compliance
*   **Cryptographic Verification**: Session tokens verified in middleware using standard HMAC SHA-256 (`HS256`) against `SUPABASE_JWT_SECRET`. Tokens approaching expiry trigger background refresh without exposing credentials.
*   **Keep-Alive Route Protection**: Protected by `Authorization: Bearer ${CRON_SECRET}` and edge rate limiting.
*   **VPC Isolation (Phase 2)**: Amazon RDS PostgreSQL resides in private database subnets with no public IP. AWS App Runner connects through a private VPC Connector with `fck-nat` handling outbound internet egress.

### Infrastructure & Cost Economics
*   **Phase 1 Cost**: $0.00/month additional expense on existing infrastructure.
*   **Phase 2 Cost**: $24.00–$27.00/month total baseline (App Runner ~$8 + RDS ~$14 + `fck-nat` ~$3.20 + snapshot storage ~$1.50), 100% covered by AWS promotional credits through February 2027. Avoids the $32/month AWS managed NAT Gateway fee.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `package.json` (Modify)
*   **Type / Scope**: Dependency Manifest
*   **Proposed Changes**:
    - Add `jose`: `npm install jose` (version `^5.9.6` or latest stable).
*   **Rationale**: Provides lightweight, standards-compliant Web Crypto JWT signature verification for Next.js Edge runtime.

#### 2. `middleware.ts` (Modify)
*   **Type / Scope**: Next.js Edge Middleware
*   **Proposed Changes**:
    - Remove the blocking remote `await supabase.auth.getSession()` call and its 1,500ms timeout guard.
    - Implement safe cookie extraction: scan for base key `sb-<ref>-auth-token` and chunked cookies (`.0`, `.1`), URL-decode, and parse JSON array to extract `access_token`.
    - Verify JWT signature and expiration (`exp`) locally via `jose.jwtVerify(token, new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!))`.
    - If valid: forward immediately via `NextResponse.next()`, executing in $< 2\text{ ms}$ with zero network calls.
    - If valid and visiting `/login` or `/signup`: redirect to `/`.
    - If unauthenticated on protected routes: redirect immediately to `/login`.
    - Sliding-window refresh: if token has $< 2$ minutes remaining, allow request to proceed to server components for transparent server-side session renewal via `Set-Cookie` response headers.
*   **Rationale**: Eliminates the 180ms–800ms intercontinental round-trip on every document request, dropping initial HTML TTFB by up to 1.5 seconds.

#### 3. `lib/services/dashboard-snapshot.ts` (Create)
*   **Type / Scope**: Server-Side Aggregation Service
*   **Proposed Changes**:
    - Import `createServerComponentClient` from `@supabase/auth-helpers-nextjs` and `cookies` from `next/headers`.
    - Export `getDashboardSnapshot(locationId: string, weekStart: string, userId?: string): Promise<DashboardSnapshot>`.
    - Execute queries in parallel using `Promise.allSettled`:
      - `shifts` (mapped to `WeekSchedule`)
      - `tasks` (`Task[]`)
      - `employees` (`Employee[]`)
      - `channels` (`ChatChannel[]`)
      - `sales` (`SalesDay[]`)
      - `alerts` (`DashboardAlert[]`)
      - `activity` (`EmployeeActivityItem[]`)
    - Implement degraded mode: if auxiliary queries (`sales`, `alerts`, `activity`) fail, return empty arrays with `{ degraded: true }` metadata, guaranteeing core schedule rendering without 500 errors.
*   **Rationale**: Collapses 8 separate browser-to-database network round-trips across continents into a single server-to-database query over low-latency local connections.

#### 4. `app/api/dashboard/snapshot/route.ts` (Create)
*   **Type / Scope**: Server Route Handler
*   **Proposed Changes**:
    - Export a `GET` route handler that parses `locationId` and `weekStart` query parameters.
    - Invoke `getDashboardSnapshot` with user session validation and return the consolidated JSON payload.
    - Include `Cache-Control: private, no-cache` headers.
*   **Rationale**: Provides a unified HTTP endpoint reserved for manual user refreshes and background client polling.

#### 5. `lib/cache/swr-cache.ts` (Modify)
*   **Type / Scope**: Client Memory Cache Layer
*   **Proposed Changes**:
    - Add `hydrateCache(entries: Record<string, any>, meta?: { locationId?: string; userId?: string }): void`.
    - Atomically write data to `memoryCache` and set `lastFetchTimeByKey.set(key, Date.now())` for all primed keys.
    - Support `revalidateOnMount: false` and initialize `isHydrated: true` when primed data exists, allowing the UI to render synchronously in initial paint with zero CLS.
*   **Rationale**: Enables the client UI to render fully populated cards immediately on mount without waiting for asynchronous fetch promises or triggering background fetch storms.

#### 6. `components/app-shell.tsx` (Modify)
*   **Type / Scope**: Main Application Shell
*   **Proposed Changes**:
    - Update `useCachedQuery` calls for `employees`, `tasks`, and `channels` to utilize the pre-hydrated SWR cache.
    - Prevent triggering redundant client-side network queries when bootstrap data is present in cache.
*   **Rationale**: Eliminates redundant parallel queries executed by the outer shell component on initial mount.

#### 7. `app/(dashboard)/page.tsx` (Modify) & `app/(dashboard)/dashboard-client.tsx` (Create)
*   **Type / Scope**: Dashboard View Architecture
*   **Proposed Changes**:
    - Refactor `app/(dashboard)/page.tsx` into an async React Server Component (RSC) wrapper:
      - Authenticates session via server cookies.
      - Awaits `getDashboardSnapshot(locationId, weekStartStr, user.id)` during SSR.
      - Renders `<DashboardClient initialSnapshot={snapshot} />`.
    - In `app/(dashboard)/dashboard-client.tsx`:
      - Accept `initialSnapshot: DashboardSnapshot`.
      - Invoke `hydrateCache` synchronously in initial component body.
      - Bypass `!mounted` skeleton gates when `initialSnapshot` is present.
      - Render dashboard widgets directly from the primed cache, removing multiple asynchronous `GlassSkeleton` layout shifts.
*   **Rationale**: Ensures that all dashboard metrics, shifts, and alerts populate together in a single paint, achieving sub-second LCP with zero client-side data requests on mount.

#### 8. `app/api/health/ping/route.ts` (Create)
*   **Type / Scope**: Database Keep-Alive Route
*   **Proposed Changes**:
    - Export a `GET` handler validating `Authorization: Bearer ${CRON_SECRET}`.
    - Execute `.from("locations").select("id").limit(1)` via Supabase client to verify database connectivity.
    - Apply edge rate limiting (max 1 request per 5 minutes).
    - Return `{ status: "ok", timestamp: string, database: "active" }`.
*   **Rationale**: Provides a secure, authenticated target for scheduled keep-alive probes to prevent free-tier compute sleeping.

#### 9. `.github/workflows/db-keepalive.yml` (Create)
*   **Type / Scope**: CI/CD Scheduled Automation
*   **Proposed Changes**:
    - Define a GitHub Actions workflow configured on a 6-hour cron schedule:
      ```yaml
      schedule:
        - cron: '0 */6 * * *'
      jobs:
        ping:
          runs-on: ubuntu-latest
          steps:
            - name: Keep-Alive Ping
              run: |
                curl -f -s -i -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
                  "${{ secrets.APP_URL }}/api/health/ping"
      ```
*   **Rationale**: Automatically prevents Supabase project inactivity pausing without manual developer intervention.

#### 10. `next.config.ts` & `Dockerfile` (Modify/Create - Phase 2 Blueprint)
*   **Type / Scope**: Containerization & Standalone Build
*   **Proposed Changes**:
    - Add `output: "standalone"` to `next.config.ts`.
    - Create a multi-stage Dockerfile:
      ```dockerfile
      FROM node:20-alpine AS runner
      WORKDIR /app
      COPY --from=builder /app/public ./public
      COPY --from=builder /app/.next/standalone ./
      COPY --from=builder /app/.next/static ./.next/static
      EXPOSE 3000
      ENV PORT=3000 HOSTNAME="0.0.0.0"
      CMD ["node", "server.js"]
      ```
*   **Rationale**: Prepares the repository for zero-downtime, warm-container deployment on AWS App Runner under Phase 2.

### Verification Plan

*   **Compilation & Linting**:
    - Run `npm run lint` — Verify zero ESLint errors or unused imports.
    - Run `npm run build` — Verify production build succeeds, edge middleware compiles cleanly with `jose`, and server routes emit without type errors.
*   **Automated Unit Tests**:
    - Run `npm test` — Verify unit tests for `hydrateCache` (verifying `memoryCache` and `lastFetchTimeByKey` seeding) and `middleware.ts` JWT signature validation pass with 100% success.
*   **Middleware Zero-Network Benchmark**:
    - Measure middleware execution time via `performance.now()`. Verify execution completes in $< 5\text{ ms}$ for authenticated requests.
    - Inspect network traffic to verify zero HTTP calls to remote GoTrue servers during page navigation.
*   **Single-Flight Network Waterfall Verification**:
    - Open Chrome DevTools Network tab on `/`.
    - Verify that initial page load transfers the pre-rendered HTML document with **zero** subsequent client-side HTTP data requests on initial paint.
    - Verify that `/api/dashboard/snapshot` is only invoked upon manual user refresh or background polling.
*   **SWR Pre-Hydration & Layout Shift (CLS) Test**:
    - Verify that all dashboard cards and the shift summary populate synchronously on initial render with zero layout shift ($\text{CLS} < 0.05$).
*   **Cross-Continental Latency Simulation**:
    - In Chrome DevTools, apply Network Throttling ("Fast 4G", 150ms RTT).
    - Measure Largest Contentful Paint (LCP) on a cold dashboard reload.
    - Success metric: $\text{LCP} \le 850\text{ ms}$ under simulated intercontinental conditions.
*   **Keep-Alive Daemon Verification**:
    - Trigger `curl -i -H "Authorization: Bearer test-secret" http://localhost:3000/api/health/ping`.
    - Verify HTTP 200 response with execution time $< 100\text{ ms}$ and active database connectivity. Verify unauthenticated calls receive HTTP 401.

--------------------------------------------------------------------------------

*Drafted with EGM*

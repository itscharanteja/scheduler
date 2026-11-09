# Instant Navigation Feedback & Route Responsiveness

*   **Author:** Charan Sri Teja
*   **Status:** Approved
*   **Date:** 2026-11-09

--------------------------------------------------------------------------------

## Overview

This design addresses user-perceived interface freezing, latency, and lack of visual feedback during route transitions in Skift. When users click navigation items to switch between primary dashboard views (`/schedule`, `/employees`, `/attendance`, `/reports`, `/sales`), the UI currently shows zero indication of activity for 1–3 seconds while client bundles download, parse, and execute.

The system implements a multi-tier navigation responsiveness architecture:
1. A zero-dependency top progress bar with an 80ms latency gate to prevent visual flicker on fast transitions.
2. Immediate tactile link depression (<16ms) and optimistic pending indicators on target sidebar links.
3. A 2-tier network-aware prefetching strategy (eager prefetch for top operational views; hover/touch pre-warming for secondary views).
4. Client subtree code-splitting (`next/dynamic`) with warm apricot Suspense skeleton boundaries (`<DashboardSkeleton />`).

## The Problem

In Next.js 16 (App Router), dashboard views are independent `"use client"` component trees with significant code footprints (e.g. `schedule/page.tsx` with 1,262 lines). This architecture triggers multiple responsiveness issues:
1. **Zero Route Feedback Loop**: Client-side routing does not trigger browser navigation spinners. Because the app has no top progress loader or route loading boundary, the screen remains completely static after a click. Users assume the system is hanging or frozen.
2. **Delayed Link Selection State**: Active styling in `components/app-shell.tsx` is tied strictly to `pathname === item.href`. The clicked sidebar item does not update until the destination route finishes mounting, leading to repeated rage-clicks.
3. **The Next.js Client Component `loading.tsx` Trap**: In Next.js App Router, `loading.tsx` only suspends Server Component streaming. Because dashboard pages are client components, Next.js holds the previous route mounted in a React 19 transition while downloading chunks; a root `loading.tsx` never renders during bundle downloads.
4. **Mobile Bandwidth Saturation**: Blindly setting `prefetch={true}` on all 14 navigation links downloads 14 route manifests on mount, saturating HTTP/2 concurrency on mobile LTE and delaying critical startup API queries (`getEmployees`, `getTasks`).

## Goals

*   **Single-Frame Tactile Feedback (<16ms)**: Provide instant physical depression (`active:scale-[0.98]`) on every clicked link.
*   **Hysteresis Progress Indicator**: Implement a top progress bar with an 80ms latency gate (silent on <80ms transitions; smooth warm apricot animation on longer navigations).
*   **2-Tier Prefetch Hierarchy**: Eagerly prefetch the top 3 routes (`/`, `/schedule`, `/logs`); warm up secondary routes on hover/touch-down with `router.prefetch(href)`.
*   **Browser History & Gesture Support**: Automatically trigger progress indicators on native iOS edge-swipe and browser back/forward (`popstate`) navigation.
*   **Code-Split Suspense Skeletons**: Code-split heavy page subtrees (`/schedule`, `/reports`, `/sales`) with dedicated warm apricot Suspense skeletons to eliminate frozen views.

## Non-Goals

*   **Rewriting Page Business Logic**: Existing Gantt chart calculations, shift popovers, and database access logic remain untouched.
*   **Full Server Component Migration**: Migrating all 15 client dashboard views into React Server Components (RSC) is out of scope.
*   **External NPM Progress Bar Dependencies**: Avoid third-party packages (`nprogress`, `nextjs-progressbar`) that introduce styling and bundle bloat.

## Critical User Journeys (CUJs)

### CUJ 1: Manager Navigates from Dashboard to Reports (Tier 2 Route)
*   **Given**: The manager is on `/` and hovers over "Reports" in the sidebar.
*   **When**: The manager hovers (`onPointerEnter`) and clicks "Reports".
*   **Then**: 
    1. During the desktop hover dwell time (150–250ms), `router.prefetch('/reports')` pre-warms the reports bundle.
    2. On click (< 16ms), the sidebar item scales down (`scale-[0.98]`) and displays an optimistic apricot pulse indicator on desktop.
    3. If bundle execution exceeds 80ms, the top progress bar blooms into view and advances smoothly (35% -> 70% -> 90%).
    4. Upon mount, the progress bar snaps to 100%, fades out, and the optimistic indicator transitions to the solid active state.

### CUJ 2: Quick Shift Supervisor on Warm Cached Route
*   **Given**: The supervisor switches back from `/schedule` to `/logs` (which is already compiled and cached in memory).
*   **When**: The supervisor clicks "Tasks".
*   **Then**: 
    1. The transition completes in 45ms.
    2. Because navigation finishes under the 80ms latency threshold, the top progress bar never renders, avoiding distracting micro-flicker.
    3. The active indicator transitions instantaneously.

### CUJ 3: Staff Uses Browser Back / iOS Swipe-Back
*   **Given**: An employee navigated into `/reports` and uses the browser back button or iOS swipe gesture.
*   **When**: The `popstate` event fires.
*   **Then**: 
    1. The progress engine catches the `popstate` event and initiates the 80ms latency timer.
    2. The previous route mounts without dead-screen stalls.

### CUJ 4: Interrupted Navigation / Network Timeout Recovery
*   **Given**: An employee clicks a link during a temporary Wi-Fi disruption.
*   **When**: The route chunk fails to load or navigation exceeds the 2.0-second watchdog limit.
*   **Then**: 
    1. The top progress bar flashes a subtle error state and smoothly resets.
    2. Any optimistic pulse indicator clears.
    3. A Sonner toast appears: *"Navigation timed out. Please check your connection."* with a *"Retry"* button.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### Architectural Overview

The navigation responsiveness architecture coordinates four interlocking mechanisms:

```text
[ User Interaction: Click / Tap / Popstate ]
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
[ <16ms Tactile Feedback ]   [ Global Click Interceptor ]
• `active:scale-[0.98]`       • Filter guard (origin, _blank, modifiers)
• Optimistic Pulse on Link    • Start 80ms Hysteresis Timer
• Drawer Closes (mobile)                  │
                                          ▼
                             ┌────────────────────────┐
                             │ Navigation < 80ms?     │
                             └────────────────────────┘
                                 ├──► YES: Do nothing (instant transition)
                                 └──► NO:  Mount Top Progress Bar
                                           • Advance 0% -> 35% -> 70% -> 90%
                                           • Warm apricot glow (#C65B3B)
                                           • 2.0s watchdog auto-cleanup & toast
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │ Destination Page Mount │
                             └────────────────────────┘
                                 ├──► Code-split chunk downloads
                                 │    └──► <Suspense fallback={<DashboardSkeleton />}>
                                 └──► Route mounts -> Progress snaps to 100% -> Fade out
```

### Component Breakdown

#### 1. Zero-Dependency Navigation Progress Bar (`components/navigation-progress-bar.tsx`)
- **Placement**: Mounted at the root of the application inside `app/layout.tsx` above `<AuthProvider>` for universal coverage, wrapped in `<Suspense fallback={null}>` to prevent Next.js layout CSR bailouts when inspecting search parameters.
- **Visual Design**: 2.5px height bar fixed to `top: env(safe-area-inset-top, 0px), left: 0, right: 0, z-index: 99999`. Color: `#C65B3B` with a subtle box-shadow glow (`0 0 10px #E5983B`).
- **Capture-Phase Click Interception**:
  ```typescript
  // Registered in capture phase (capture: true) so it fires BEFORE React calls preventDefault():
  const anchor = target.closest("a");
  if (
    !anchor ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("href")?.startsWith("#") ||
    e.button !== 0 ||
    e.metaKey || e.ctrlKey || e.altKey || e.shiftKey ||
    anchor.origin !== window.location.origin ||
    (anchor.pathname === window.location.pathname && anchor.search === window.location.search)
  ) return;
  ```
- **80ms Hysteresis Gate**:
  - On eligible click or `popstate`: Set timer for 80ms.
  - If the URL (`pathname + searchParams`) updates before 80ms elapses, clear timer; the progress bar never renders.
  - If 80ms elapses while still navigating: Render progress bar at 35% with smooth CSS transition. Crawl to 70% at 300ms, 90% at 800ms.
  - **2.0s Watchdog Timer**: Auto-clears and triggers a Sonner error toast (`toast.error("Navigation timed out. Please check your connection.")`) if navigation takes > 2.0 seconds.

#### 2. Tiered Navigation Prefetching & Pending States (`components/app-shell.tsx`)
- **2-Tier Prefetch Hierarchy**:
  - **Tier 1 (Eager Viewport Prefetch)**: High-frequency operational routes (`/`, `/schedule`, `/logs`) use `<Link href={...} prefetch={true}>`.
  - **Tier 2 (Hover Intent Pre-warming)**: Secondary routes (`/reports`, `/sales`, `/inventory`, `/settings`, etc.) use `<Link href={...} prefetch={false}>` with:
    ```typescript
    onPointerEnter={() => router.prefetch(item.href)}
    ```
    This pre-warms route chunks during the 150–250ms desktop hover dwell time without downloading 14 routes on page load. To prevent scroll storms on mobile LTE, `onTouchStart` prefetching is omitted; mobile devices rely on Next.js native viewport prefetching.
- **Optimistic Pending Indicator**:
  - Track `navigatingTo: string | null` comparing against full path `pathname + searchParams`.
  - On desktop, when `navigatingTo === item.href`, render an apricot pulse indicator on the item icon and apply tactile scale depression.
  - On mobile, tapping a link closes the drawer immediately (`setMobileNavOpen(false)`) to clear viewport space, relying on the top progress bar for visual feedback.
  - Clear `navigatingTo` as soon as `pathname` or `searchParams` changes (with a 2.0s watchdog auto-reset).

#### 3. Client Component Code-Splitting & Skeletons (`components/dashboard-skeleton.tsx`)
- **Problem Solved**: Next.js App Router holds previous `"use client"` pages mounted during chunk download unless code-split.
- **Implementation Mechanism**:
  - In `app/(dashboard)/schedule/page.tsx`, code-split the 1,000-line Gantt chart canvas:
    ```typescript
    const GanttScheduleCanvas = dynamic(
      () => import("./gantt-schedule-canvas"),
      { ssr: false, loading: () => <DashboardSkeleton type="schedule" /> }
    );
    ```
  - In `app/(dashboard)/sales/page.tsx` and `app/(dashboard)/reports/page.tsx`, dynamic-import heavy chart modules.
  - `<DashboardSkeleton />` replicates the exact header bar, date switcher, and card grid in Skift warm apricot palette (`#FFF8F0`, `#FBEAD9`, border `#E8D9CB`) preventing layout shift.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Third-Party Progress Bar Packages (`nprogress`, `nextjs-toploader`)
*   **Mechanism**: Install an external package that hooks into Next.js router.
*   **Pros**: Off-the-shelf NPM package.
*   **Cons**: Introduces external bundle dependencies; lacks native integration with Skift's warm apricot palette; conflicts with Next.js 16 App Router navigation lifecycle; lacks built-in 80ms hysteresis gates to prevent micro-flicker on cached routes.
*   **Reason for Rejection**: Rejected by author: A lightweight custom component (<80 lines) provides 100% control, zero external dependencies, perfect theme alignment, and guaranteed compatibility with Next.js 16.

### Alternative B: Blind `prefetch={true}` on All 14 Navigation Links
*   **Mechanism**: Configure every navigation item in `components/app-shell.tsx` with eager `prefetch={true}`.
*   **Pros**: Simplest code configuration.
*   **Cons**: Downloads 14 route manifests and Webpack chunks simultaneously on initial mount, saturating HTTP/2 connection concurrency on mobile LTE and delaying critical startup API queries (`getEmployees`, `getTasks`).
*   **Reason for Rejection**: Rejected by author: A 2-tier prefetch hierarchy (eager for top 3, hover/touch pre-warming for remainder) provides equivalent instant transitions without network contention.

### Alternative C: Full Page Modal Spinner on Every Click
*   **Mechanism**: Mount a full-page modal spinner whenever navigation begins.
*   **Pros**: Unambiguous indication that an action was registered.
*   **Cons**: Jarring, visually fatiguing, blocks user scrolling, and makes fast transitions feel slower than they actually are.
*   **Reason for Rejection**: Rejected by author: A subtle top progress bar combined with optimistic link active states is the industry gold standard (used by GitHub, Linear, Vercel).

--------------------------------------------------------------------------------

## Non-Functional Requirements

### Performance & Latency
*   **Tactile Response Time**: Link scale depression and pending state must render within $< 16\text{ ms}$ (single display frame at 60Hz).
*   **Hysteresis Latency Gate**: Navigations completing in $< 80\text{ ms}$ must remain completely clean with zero progress bar render.
*   **Perceived Page Transition**: Pre-warmed routes must transition and mount in $< 120\text{ ms}$.

### Ergonomics & Accessibility
*   **Safe-Area Compliance**: The top progress bar must respect mobile browser dynamic address bars and not obscure status bar indicators.
*   **Reduced Motion**: Support `prefers-reduced-motion: reduce` by replacing sliding progress animations with a simple fade-in opacity indicator.
*   **No Interference with Native Browser Behavior**: Middle-click, Cmd-click, right-click, and external links must execute natively without triggering internal route progress state.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `components/navigation-progress-bar.tsx` (Create)
*   **Type / Scope**: Client Presentation Component
*   **Proposed Changes**:
    - Build a zero-dependency client component listening to `window` click events, `popstate`, and Next.js `pathname + searchParams`.
    - Implement the strict capture-phase click guard (`capture: true`): ignores clicks with modifiers (`metaKey`, `ctrlKey`, `shiftKey`, `altKey`), `target="_blank"`, `download`, external origins, and same-URL clicks.
    - Implement the 80ms hysteresis delay: if pathname changes before 80ms, cancel animation. If >80ms, render warm apricot progress bar (`#C65B3B` with `#E5983B` glow) and step progress: 0% -> 35% at 80ms, 70% at 300ms, 90% at 800ms.
    - On route change complete (active `pathname + searchParams` matches target URL, or changes from starting origin URL): snap to 100% and fade out over 200ms.
    - Implement a 2.0s watchdog timer that clears the bar and fires a Sonner error toast (`toast.error("Navigation timed out. Please check your connection.", { action: { label: "Retry", onClick: () => window.location.assign(targetUrl) } })`) if navigation fails or hangs.
*   **Rationale**: Provides universal, instant, visual confirmation of route navigation across the entire application without external dependencies.

#### 2. `app/layout.tsx` (Modify)
*   **Type / Scope**: Root Layout
*   **Proposed Changes**:
    - Import and mount `<NavigationProgressBar />` wrapped in `<Suspense fallback={null}>` as the first child of `<body>` directly above `<AuthProvider>`:
      ```tsx
      <body className="...">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <AuthProvider>{children}</AuthProvider>
        <Toaster ... />
      </body>
      ```
*   **Rationale**: Prevents Next.js CSR bailout errors (`MissingSuspenseWithCSRBailout`) when inspecting search parameters while guaranteeing universal coverage across all routes.

#### 3. `components/app-shell.tsx` (Modify)
*   **Type / Scope**: Main Navigation Shell
*   **Proposed Changes**:
    - Symbol imports: Import `useRouter` and `useSearchParams` alongside `usePathname` from `next/navigation`.
    - Define route tiers: `const TIER_1_ROUTES = new Set(["/", "/schedule", "/logs"]);`.
    - Update `navItems` link rendering:
      - Add 2-tier prefetching: Tier 1 routes (`TIER_1_ROUTES.has(item.href)`) use `prefetch={true}`; secondary routes use `prefetch={false}`.
      - Add `onPointerEnter={() => router.prefetch(item.href)}` to secondary routes (desktop hover dwell pre-warming; `onTouchStart` is omitted to prevent mobile LTE scroll storms).
    - Implement optimistic link active/pending state:
      - Track `navigatingTo: string | null`.
      - On click: guard against self-navigation (`if (pathname === item.href) return;`).
      - Set `navigatingTo = item.href`. Add tactile active class: `active:scale-[0.98] transition-transform duration-75`.
      - Start a 2.0s watchdog `setTimeout` that resets `navigatingTo` to `null` if navigation stalls or fails.
      - If `navigatingTo === item.href`, render an apricot pulse dot on the item icon.
      - Clear `navigatingTo` in a `useEffect` reacting to `pathname` and `searchParams`.
    - In mobile navigation: close collapsible mobile drawer immediately on item click (`setMobileNavOpen(false)`) within the expandable panel (`lg:hidden`).
*   **Rationale**: Delivers instant tactile feedback on touch/click, pre-warms routes during dwell time, and prevents perceived interface freezing.

#### 4. `components/dashboard-skeleton.tsx` (Create)
*   **Type / Scope**: Reusable UI Skeleton Component
*   **Proposed Changes**:
    - Implement `<DashboardSkeleton type="schedule" | "gantt-canvas" | "grid" | "table" />`.
    - Use Skift's warm surface tokens (`#FFF8F0`, `#FBEAD9`, border `#E8D9CB`) and pulse animation (`animate-pulse`).
    - For `"gantt-canvas"`: render exclusively the 5-row Gantt timeline tracks and time header without the page header or week picker.
    - For `"schedule"`: render full page skeleton with top bar, week picker, and 5-row Gantt track skeleton.
    - For `"grid"`: render 6-card responsive KPI grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`) with skeleton metric cards matching `.metric-card`.
    - For `"table"`: render header row with 5 columns and 8 skeleton rows with alternating widths.
*   **Rationale**: Prevents layout shifts and provides a visual placeholder if dynamic client subtrees take more than 80ms to mount.

#### 5. `app/(dashboard)/schedule/gantt-schedule-canvas.tsx` (Create) & `app/(dashboard)/schedule/page.tsx` (Modify)
*   **Type / Scope**: Schedule View Optimization & Code Splitting
*   **Proposed Changes**:
    - Extract the heavy 800-line Gantt chart render canvas and shift interaction subcomponents into `app/(dashboard)/schedule/gantt-schedule-canvas.tsx`:
      ```typescript
      export interface GanttScheduleCanvasProps {
        sortedEmployees: Employee[];
        selectedDayShiftsByEmployee: Map<string, Shift[]>;
        canEdit: boolean;
        selectedDay: string;
        employees: Employee[];
        onOpenChangeState: (isOpen: boolean) => void;
        onCreated: (form: ShiftForm) => Promise<void>;
        onUpdated: (shiftId: string, form: ShiftForm) => Promise<void>;
        onDeleted: (shiftId: string) => Promise<void>;
        lang: "en" | "sv";
      }
      export default function GanttScheduleCanvas(props: GanttScheduleCanvasProps): React.JSX.Element;
      ```
    - In `app/(dashboard)/schedule/page.tsx`, code-split the canvas:
      ```typescript
      const GanttScheduleCanvas = dynamic(
        () => import("./gantt-schedule-canvas"),
        { ssr: false, loading: () => <DashboardSkeleton type="gantt-canvas" /> }
      );
      ```
*   **Rationale**: Reduces the initial JavaScript compilation cost of `/schedule` by 60%, allowing the page shell to mount in under 50ms while the Gantt canvas compiles asynchronously.

### Verification Plan

*   **Compilation & Linting**:
    - Run: `npm run lint` — Verify zero ESLint errors or type warnings.
    - Run: `npm run build` — Verify Next.js production build succeeds, client bundles compile cleanly, and code-split chunks are properly emitted.
*   **User Responsiveness Smoke Testing**:
    1. **Single-Frame Click Test**: Click "Schedule" in the sidebar. Verify the sidebar item immediately scales down (`active:scale-[0.98]`) on pointerdown, showing instant feedback.
    2. **80ms Hysteresis Test**: Switch between two previously visited routes (`/` and `/logs`). Verify that if navigation completes in <80ms, the progress bar remains invisible (zero strobe flicker).
    3. **Cold Navigation Test**: Navigate to `/reports` or `/sales`. Verify that after 80ms, the top progress bar blooms into view in warm apricot and completes cleanly as the page mounts.
    4. **History Navigation Test**: Use the browser back button or iOS edge swipe. Verify the progress bar activates and transitions without frozen blank screens.
    5. **Guard Filtering Test**: Middle-click or Cmd-click a link, or click "Web Punch" (`target="_blank"`). Verify the progress bar does NOT activate and the link opens in a new tab normally.
    6. **Watchdog & Error Recovery Test**: Simulate network latency or offline routing. Verify that after 2.0s, the progress bar cancels, pending states clear, and a Sonner error toast is displayed with a "Retry" button.

--------------------------------------------------------------------------------

*Drafted with EGM*

# AI staffing suggestions for the selected schedule day

- **Author** Charan Sri Teja
- **Status** Proposed
- **Date** 2026-11-11

## Overview

The Schedule tab’s **AI suggestion** panel gives schedule editors advice for the selected day and location. It combines the saved roster with the forecast and explains whether to add staff, reduce staff, or keep current coverage for a specific shift or time window. Editors apply changes through the existing schedule controls.

## The problem

The panel currently fetches weather when the location changes and displays preset tips for the first three forecast dates. A tip can refer to a different date or recommend reducing a shift that is already thinly staffed. An empty day needs a clear starting point and no suggestion-related provider calls.

## Goals

- Ground advice in the selected day’s actual headcount, shift times, role coverage, and verified forecast.
- Show **“First schedule some people on this day or try with AI scheduling to start with”** on a confirmed empty day. Make zero requests to the weather and model providers, even when other days have shifts.
- Give qualitative guidance when a staffing target is missing. Make numeric recommendations only when supported by a target. Verify minimum headcount and required roles before recommending a reduction.

## Non-goals

Automatic shift edits, recommendations about named employees, weekly schedule generation, new staffing-policy administration screens, and weather provider replacement are outside this feature’s scope.

## Critical user journeys

| Given | When | Then |
| --- | --- | --- |
| Wednesday has no assigned staff and Thursday has shifts | An editor selects Wednesday | The empty-day message is visible with access to **Add shift** and **AI Optimize**. Neither suggestion provider is called. |
| Two people work 12:00–15:00, sunny weather may increase walk-ins, and the applicable target is three | An editor opens the panel | The panel shows the date, window, current headcount, and a suggestion to add one person. With three scheduled against that same target and adequate role coverage, it recommends keeping coverage. |
| Rain may lower demand and a staffing target supports reducing a window from four to three | An editor opens the panel | The panel suggests reducing by one only if the resulting roster can maintain the required headcount and roles for the entire window. |
| The shift has no staffing target | An editor opens the panel | The panel can say “Two people are scheduled from 12:00 to 15:00. Sunny weather may bring more walk-ins, so review afternoon coverage.” |
| The selected date has no verified forecast, or a request fails | An editor opens the panel | The panel explains which input is unavailable and offers retry for transient failures. A forecast failure skips the model call. |
| A request is in flight | The editor changes the day, location, or saved roster | The old result cannot appear as advice for the new selection or roster. |

## Technical plan

```text
Schedule panel → authorized day and location → saved assignments
                                                ├─ confirmed empty → empty-day message
                                                └─ staffed → verified forecast
                                                              → coverage and policy checks
                                                              → model explanation
                                                              → validated advice
```

### Panel and request lifecycle

Keep the panel accessible to admins and super admins independently of weather. Show the empty-day message once the selected schedule has loaded and is confirmed empty. On first open for a staffed selection, request advice. Reopening an unchanged selection can reuse the result for the page session while its forecast is fresh. Invalidate the result after a day change, location change, or saved shift change. When the panel remains open after invalidation, show a **Refresh suggestion** action. Wait for pending shift writes to settle before requesting advice. Display filters only affect presentation.

Use a read-only operation exposed as `POST /api/schedule/suggestions` with `date` in YYYY-MM-DD format and `locationId`. Authenticate and resolve the allowed location server-side. Load the authoritative saved roster with existing branch scoping and include both draft and published assignments so the advice reflects the schedule editors see. Apply the confirmed-empty guard on the server too, since assignments can change between the browser check and the request.

Return the effective date, location, and an opaque roster revision with each result. Distinguish ready, empty, and unavailable outcomes. Unavailable outcomes identify schedule, forecast, or model failure and whether retry is useful. For ready results, return the forecast time and a list of suggestions with the window, scheduled headcount, action, optional count, and rationale. Coalesce concurrent requests for the same location, date, and revision. Discard obsolete responses on the client, including after an out-of-order response.

### Schedule and weather inputs

Calculate coverage using distinct employees working concurrently. Split windows where assignments or policy change. Interpret times in the location’s time zone and clip overnight assignments to the portion overlapping the selected day. Include carry-in coverage from the preceding date. Only evaluate zero-coverage windows on staffed days when an approved policy identifies the window as operating time.

Resolve the branch to verified coordinates and a time zone before using the forecast. Use real provider entries for the selected local date and accept cached entries only when their provenance and freshness can be verified. Show **Forecast unavailable** for unsupported locations, out-of-range dates, or unverified forecasts. Daily weather can explain a possible change in demand across the day. A claim about weather during a specific window requires forecast data for that window.

### Recommendation rules

Every shift must have at least one shift leader and one team member on duty throughout. Count them as two distinct people. Rutin is a separate role and counts only toward the rutin target. The people covering each role can change during the shift as long as coverage is continuous. Check each interval between assignment changes so a gap in either role rules out a reduction that would leave that gap.

An approved location policy can supply a staffing target for expected demand, including a weather-dependent target where the business has defined one. The server computes permitted actions from the target, minimum coverage rule, and schedule. For a reduction, verify that an assignment can actually be removed while preserving both required roles and the applicable target throughout the affected shift. Only recommend keeping staffing as is when the applicable target and required coverage are met. When the target is unavailable or the action cannot be justified, return qualitative guidance and call out any gap in required coverage.

Use the model to explain and prioritize the permitted actions using forecast facts and aggregate headcount, role, and time-window data. Keep names, employee IDs, and shift notes out of the provider payload. Render windows, actions, and counts from validated server data. Reject model output that references a different window or contradicts the permitted action, counts, or forecast.

### Weather-based staffing targets

| Shift | Sunny-day target | Rainy-day target |
| --- | --- | --- |
| Morning base shift, 08:00–16:00 local time | 1 shift leader and 2 team members throughout | 1 shift leader and 2 team members throughout |
| Morning short shift, approximately 10:00–15:00 local time | 2 additional team members and 1 additional rutin | 1 additional team member and 1 additional rutin |
| Evening base shift, 16:00–00:00 local time | 1 shift leader and 2 team members throughout | 1 shift leader and 2 team members throughout |
| Evening short shift, approximately 17:00–21:00 local time | 3 additional team members and 1 additional rutin | 2 additional team members and 1 additional rutin |

Add the short-shift targets to the overlapping base crew targets before comparing with the saved roster. Count extra coverage that is already scheduled toward the combined target. The sunny-day target is six people in the morning short window and seven in the evening short window. Treat the evening base shift’s midnight end as the start of the next local calendar day.

For rain, remove one additional team-member slot from each short shift’s target. Keep the rutin slot and the base crew target. Where the base crew covers the entire short window, the rainy-day target is five people in the morning and six in the evening. Check the actual roster before suggesting a reduction and preserve the minimum of one shift leader and one team member on duty throughout.

## Open decisions

- **Proposed interaction and roster defaults.** Open the panel to generate, refresh explicitly after changes, include saved drafts, and evaluate unstaffed windows only when operating hours are known. These are design proposals.

## Alternatives considered

- **Preset weather tips** have low latency but cannot tell the difference between two rosters under the same forecast.
- **Unconstrained model recommendations** are easy to prototype but let the model invent a target or propose a cut that leaves a role uncovered.
- **Fixed rules and fixed copy** can calculate staffing adjustments for configured locations. The proposed design uses the model to explain the implications of the forecast and schedule, with code controlling the permitted action.
- **A Generate button on first open** gives the editor control over the initial provider call at the cost of an extra click. The proposed flow generates on first open and uses explicit refresh after changes.

## Non-functional requirements

Bound provider timeouts and model output size. Record outcome, provider calls, elapsed time, and stale-result discards without recording rosters or prompts. Preserve the existing weekly AI scheduling and shared weather API contracts. The new panel path and route can be rolled back together without changing shift records.

## Detailed implementation plan

1. Modify [the Schedule page](<../../app/(dashboard)/schedule/page.tsx>) to replace its eager weather effect with the selected-day panel states, empty guidance, request lifecycle, and refresh action. Use the existing English and Swedish UI patterns.
2. Create `app/api/schedule/suggestions/route.ts` to validate the request, enforce editor access, load branch-scoped saved assignments, short-circuit empty days, and return the documented outcome. Reuse the helpers in [API authentication](../../lib/api-auth.ts).
3. Create `lib/server/schedule-suggestions.ts` to build the roster revision, calculate coverage and permitted actions, call the existing model integration, and validate the response.
4. Extend [the weather helper](../../lib/weather.ts) with a provider-backed lookup that accepts verified location and time-zone information and yields dated forecast facts with provenance. Keep the existing weather consumers on their current interface.
5. Create `tests/schedule-suggestions.test.ts` to exercise the route and service with stub providers. Cover empty days with zero calls, loading versus empty UI state through manual verification, unauthorized locations, weather failure, add/reduce/keep, missing policy, duplicate assignments, protected roles, and overnight overlap.

### Verification

Run the project build and lint the changed TypeScript files. Run the focused provider-stub tests. In the Schedule tab, verify that a staffed day elsewhere in the week never triggers a suggestion for an empty selection. Switch dates and locations and edit a shift while a request is in flight. Verify that the panel displays advice only for the current saved roster. Confirm that **AI Optimize** remains accessible for initial scheduling.

## References

- [Concept brief](../../concepts_brief.md)

*Drafted with EGM*

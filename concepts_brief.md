# AI staffing suggestions for the selected schedule day

- Author **Charan Sri Teja**
- Date **2026-11-11**

## Overview

When a schedule editor selects a day, the **AI suggestion** panel should use the staff already scheduled at that location and the forecast for that date. It should recommend adding staff, reducing staff, or keeping staffing as is for a shift or time window. Show the current headcount and explain how the forecast and existing coverage inform the recommendation. The editor decides whether to make a change.

When the selected day is confirmed to have zero scheduled staff, the panel shows **“First schedule some people on this day or try with AI scheduling to start with”** and skips both the weather and AI calls. Staff scheduled on another day do not affect this behavior.

## Analysis

### Coverage and expected demand

The current Schedule tab checks whether the day has four shift records and any shift leader. That can miss a window where coverage drops and can count the same person twice. Count distinct people and required roles working concurrently. A minimum defines what coverage to protect. A staffing target or expected-demand rule gives the model a basis for how many people to add or remove. The schedule and weather alone tell us who is working and what might affect demand. They may leave the size of a staffing adjustment uncertain.

When a shift has no staffing target, show qualitative guidance based on the actual coverage and likely demand. For example, “Two people are scheduled from 12:00 to 15:00. Sunny weather may bring more walk-ins, so review afternoon coverage.” Give a numeric recommendation only when the evidence supports it. A reduction also needs a verified minimum for headcount and required roles.

For example, on **Wednesday — 2026-11-11**, the afternoon shift has two people scheduled from 12:00 to 15:00. If the staffing target for a sunny afternoon is three, suggest adding one person and explain that sunny weather may bring more walk-ins. If the same window already meets the target, suggest keeping the schedule as is. On a rainy morning, suggest reducing from four to three only if expected demand supports it and three people would still cover the required roles throughout the affected window.

### Weather for the selected day

The current weather integration fetches Gothenburg conditions, groups forecast entries by UTC date, fills dates beyond the provider’s forecast, and can return sample data. Use a verified forecast for the location and its local date. A daily forecast can inform the day’s expected demand while the schedule identifies the window to discuss. A claim such as rain from 12:00 to 15:00 needs forecast data for those hours. If verified weather is unavailable, show that state and skip the weather-based AI recommendation. Existing weekly AI scheduling uses the shared forecast data, so the daily feature should preserve that contract.

### Request timing and schedule changes

Keep the suggestion panel available to schedule editors even on an empty day. A proposed first version generates on demand when the panel opens and the schedule has loaded. The server checks access to the selected location and reads the saved schedule before any provider call. Count scheduled staff even when a display filter hides their rows. Loading, a failed read, a confirmed empty schedule, and a forecast or model failure each need their own outcome.

Tie every response to the selected location, date, and schedule used to generate it. Reuse an in-flight request for the same inputs and discard results if the day, location, or staffing changes. Send only headcounts, roles, and time windows to the model. Record skip and failure reasons, request duration, and provider call counts. The zero-staff check should be verifiable at both provider boundaries.

To verify the behavior, try the same forecast with two schedules that have different coverage and check that the recommendations can differ. Also check an empty selected day in a staffed week, a forecast outside provider coverage, and a shift edit while a suggestion is loading.

## Goals and scope

- Use the selected day’s actual staffing and forecast to explain a shift-level recommendation.
- Support adding, reducing, and keeping staffing as is. Distinguish an evidence gap from a recommendation to keep the schedule as is.
- Reuse the Schedule panel and existing **AI Optimize** entry point for initial scheduling. Keep the recommendation advisory and leave edits to the schedule editor.

## Alternatives weighed

- Preset weather tips are cheap to generate, but the same tip can appear for a fully staffed shift and a short-staffed shift.
- A model that chooses the action and the staffing limits from the prompt alone requires less setup, but it can infer a staffing target the location never adopted. Prefer structured suggestions checked against schedule facts and agreed coverage rules.
- Fixed rules can calculate every adjustment if staffing targets exist. Using the model to explain how weather and schedule facts apply keeps the advice readable while code checks the result.
- Panel-open generation keeps the existing interaction. A separate Generate button gives editors more control over request timing and avoids a provider call when they only want to inspect the panel.

## Decisions for the design

- Identify where staffing targets and minimum role coverage come from. Use the agreed qualitative fallback for shifts without a staffing target.
- Confirm whether saved draft shifts count alongside published shifts. Counting both would match the current Schedule view. Also confirm whether advice can flag a time window with zero coverage when another part of the day has scheduled staff.
- Decide when the panel should generate again after an edit or date change. Invalidate advice as soon as its schedule stops matching and reuse the existing weather cache only when its forecast source and freshness can be verified.

# App / Api / Sim / Scenario

## Overview
Server-side API route handler servicing `/api/sim/scenario` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L12] Guard: `return NextResponse.json({ error: "Invalid scenario name. Allowed: rush_hour, weather_spike, stockou`
- [route.ts:L28] Guard: `return NextResponse.json({ error: "Failed to trigger scenario" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

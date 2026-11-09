# App / Api / Alerts

## Overview
Server-side API route handler servicing `/api/alerts` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:PATCH] (function)

## Invariants
- [route.ts:L18] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L26] Guard: `return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });`
- [route.ts:L38] Guard: `return NextResponse.json({ error: "alertId is required" }, { status: 400 });`
- [route.ts:L44] Guard: `return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

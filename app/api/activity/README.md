# App / Api / Activity

## Overview
Server-side API route handler servicing `/api/activity` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L12] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L20] Guard: `return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

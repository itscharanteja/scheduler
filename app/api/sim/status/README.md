# App / Api / Sim / Status

## Overview
Server-side API route handler servicing `/api/sim/status` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L16] Guard: `return NextResponse.json({ error: "Failed to get simulation status" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

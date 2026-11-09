# App / Api / Sim / Pause

## Overview
Server-side API route handler servicing `/api/sim/pause` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L11] Guard: `return NextResponse.json({ error: "Failed to pause simulation" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

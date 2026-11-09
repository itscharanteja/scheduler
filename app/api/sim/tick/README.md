# App / Api / Sim / Tick

## Overview
Server-side API route handler servicing `/api/sim/tick` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L17] Guard: `return NextResponse.json({ error: "Failed to tick simulation" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

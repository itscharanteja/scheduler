# App / Api / Sim / Speed

## Overview
Server-side API route handler servicing `/api/sim/speed` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L13] Guard: `return NextResponse.json({ error: "Failed to update speed" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

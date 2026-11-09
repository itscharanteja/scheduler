# App / Api / Sim / Reset

## Overview
Server-side API route handler servicing `/api/sim/reset` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L11] Guard: `return NextResponse.json({ error: "Failed to reset simulation" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

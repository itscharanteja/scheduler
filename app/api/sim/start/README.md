# App / Api / Sim / Start

## Overview
Server-side API route handler servicing `/api/sim/start` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L11] Guard: `return NextResponse.json({ error: "Failed to start simulation" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

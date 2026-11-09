# App / Api / Feed / [id] / Like

## Overview
Server-side API route handler servicing `/api/feed/[id]/like` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L14] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

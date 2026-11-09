# App / Api / Generate-schedule

## Overview
Server-side API route handler servicing `/api/generate-schedule` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L121] Precondition error check: `throw new Error("Model did not return a JSON object.");`
- [route.ts:L136] Guard: `{ status: 500 }`
- [route.ts:L144] Guard: `{ status: 400 }`
- [route.ts:L409] Guard: `return NextResponse.json({ error: message }, { status: 500 });`

## Side Effects
- [route.ts:L231] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

# App / Api / Sales

## Overview
Server-side API route handler servicing `/api/sales` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L13] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L52] Guard: `return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

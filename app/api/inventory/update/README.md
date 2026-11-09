# App / Api / Inventory / Update

## Overview
Server-side API route handler servicing `/api/inventory/update` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L27] Guard: `{ status: 400 },`
- [route.ts:L33] Guard: `{ status: 403 },`
- [route.ts:L40] Guard: `{ status: 400 },`
- [route.ts:L60] Guard: `return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });`
- [route.ts:L101] Guard: `return NextResponse.json({ error: "Internal server error", success: false }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

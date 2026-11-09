# App / Api / Shift-logs / Update

## Overview
Server-side API route handler servicing `/api/shift-logs/update` endpoints.

## Interface
- [route.ts:PATCH] (function)

## Invariants
- [route.ts:L23] Guard: `return NextResponse.json({ error: "id is required", success: false }, { status: 400 });`
- [route.ts:L27] Guard: `return NextResponse.json({ error: "Supabase client is not configured", success: false }, { status: 5`
- [route.ts:L39] Guard: `{ status: 400 },`
- [route.ts:L50] Precondition error check: `if (error) throw error;`
- [route.ts:L81] Guard: `return NextResponse.json({ error: "Failed to update shift log", success: false }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

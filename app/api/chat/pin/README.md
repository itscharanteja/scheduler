# App / Api / Chat / Pin

## Overview
Server-side API route handler servicing `/api/chat/pin` endpoints.

## Interface
- [route.ts:PATCH] (function)

## Invariants
- [route.ts:L21] Guard: `return NextResponse.json({ error: "messageId is required" }, { status: 400 });`
- [route.ts:L25] Guard: `return NextResponse.json({ error: "Supabase client is not configured" }, { status: 500 });`
- [route.ts:L33] Precondition error check: `if (error) throw error;`
- [route.ts:L38] Guard: `return NextResponse.json({ error: "Failed to pin message" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

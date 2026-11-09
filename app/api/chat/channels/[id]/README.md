# App / Api / Chat / Channels / [id]

## Overview
Server-side API route handler servicing `/api/chat/channels/[id]` endpoints.

## Interface
- [route.ts:PATCH] (function)
- [route.ts:DELETE] (function)

## Invariants
- [route.ts:L56] Guard: `return NextResponse.json({ error: "Channel id is required" }, { status: 400 });`
- [route.ts:L63] Guard: `return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });`
- [route.ts:L76] Guard: `return NextResponse.json({ error: "Nothing to update" }, { status: 400 });`
- [route.ts:L93] Precondition error check: `throw error;`
- [route.ts:L99] Guard: `return NextResponse.json({ error: "Failed to update channel" }, { status: 500 });`
- [route.ts:L114] Guard: `return NextResponse.json({ error: "Channel id is required" }, { status: 400 });`
- [route.ts:L121] Guard: `return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });`
- [route.ts:L129] Precondition error check: `if (error) throw error;`
- [route.ts:L134] Guard: `return NextResponse.json({ error: "Failed to delete channel" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

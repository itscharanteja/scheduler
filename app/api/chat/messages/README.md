# App / Api / Chat / Messages

## Overview
Server-side API route handler servicing `/api/chat/messages` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:PATCH] (function)
- [route.ts:DELETE] (function)

## Invariants
- [route.ts:L24] Guard: `return NextResponse.json({ error: "channelId is required" }, { status: 400 });`
- [route.ts:L33] Guard: `return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });`
- [route.ts:L48] Guard: `{ status: 400 },`
- [route.ts:L53] Guard: `return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });`
- [route.ts:L71] Guard: `return NextResponse.json({ error: "Failed to edit message" }, { status: 500 });`
- [route.ts:L84] Guard: `return NextResponse.json({ error: "messageId is required" }, { status: 400 });`
- [route.ts:L88] Guard: `return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });`
- [route.ts:L110] Guard: `return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

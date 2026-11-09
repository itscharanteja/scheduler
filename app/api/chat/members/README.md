# App / Api / Chat / Members

## Overview
Server-side API route handler servicing `/api/chat/members` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:POST] (function)
- [route.ts:DELETE] (function)

## Invariants
- [route.ts:L20] Guard: `return NextResponse.json({ error: "channelId is required" }, { status: 400 });`
- [route.ts:L26] Guard: `return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });`
- [route.ts:L42] Guard: `{ status: 400 },`
- [route.ts:L50] Guard: `return NextResponse.json({ error: "Failed to add member" }, { status: 500 });`
- [route.ts:L66] Guard: `{ status: 400 },`
- [route.ts:L74] Guard: `return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

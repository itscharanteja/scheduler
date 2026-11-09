# App / Api / Shift-logs / Create

## Overview
Server-side API route handler servicing `/api/shift-logs/create` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L23] Guard: `{ status: 403 },`
- [route.ts:L32] Guard: `return NextResponse.json({ error: "locationId is required", success: false }, { status: 400 });`
- [route.ts:L35] Guard: `return NextResponse.json({ error: "date is required", success: false }, { status: 400 });`
- [route.ts:L38] Guard: `return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD", success: false }, { status:`
- [route.ts:L43] Guard: `{ status: 400 },`
- [route.ts:L47] Guard: `return NextResponse.json({ error: "notes is required and cannot be empty", success: false }, { statu`
- [route.ts:L50] Guard: `return NextResponse.json({ error: "notes must be 2000 characters or less", success: false }, { statu`
- [route.ts:L53] Guard: `return NextResponse.json({ error: "issuesFlagged must be a boolean", success: false }, { status: 400`
- [route.ts:L56] Guard: `return NextResponse.json({ error: "tasksCompleted must be an array", success: false }, { status: 400`
- [route.ts:L59] Guard: `return NextResponse.json({ error: "tasksPending must be an array", success: false }, { status: 400 }`
- [route.ts:L76] Guard: `return NextResponse.json({ error: "Failed to create shift log", success: false }, { status: 500 });`
- [route.ts:L108] Guard: `return NextResponse.json({ error: "Failed to create shift log", success: false }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

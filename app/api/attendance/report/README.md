# App / Api / Attendance / Report

## Overview
Server-side API route handler servicing `/api/attendance/report` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:PATCH] (function)

## Invariants
- [route.ts:L21] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L33] Guard: `return NextResponse.json({ error: "Failed to load attendance report." }, { status: 500 });`
- [route.ts:L51] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L58] Guard: `return NextResponse.json({ error: "Invalid request body." }, { status: 400 });`
- [route.ts:L63] Guard: `return NextResponse.json({ error: "sessionId is required." }, { status: 400 });`
- [route.ts:L71] Guard: `if (!session) {`
- [route.ts:L77] Guard: `return NextResponse.json({ error: "Failed to update session." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

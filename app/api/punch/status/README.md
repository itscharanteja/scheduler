# App / Api / Punch / Status

## Overview
Server-side API route handler servicing `/api/punch/status` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L13] Guard: `return NextResponse.json({ error: "Missing employeeId parameter." }, { status: 400 });`
- [route.ts:L21] Guard: `return NextResponse.json({ error: "Failed to load punch status." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

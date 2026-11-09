# App / Api / Punch / Employees

## Overview
Server-side API route handler servicing `/api/punch/employees` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L14] Guard: `return NextResponse.json({ error: "Missing loc parameter." }, { status: 400 });`
- [route.ts:L22] Guard: `return NextResponse.json({ error: "Failed to load employees." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

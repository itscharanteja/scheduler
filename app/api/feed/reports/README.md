# App / Api / Feed / Reports

## Overview
Server-side API route handler servicing `/api/feed/reports` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:PATCH] (function)

## Invariants
- [route.ts:L45] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L46] Guard: `if (!isAdminRole(caller.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
- [route.ts:L60] Guard: `return NextResponse.json({ error: "Database error" }, { status: 500 });`
- [route.ts:L69] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L70] Guard: `if (!isAdminRole(caller.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
- [route.ts:L76] Guard: `return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });`
- [route.ts:L81] Guard: `return NextResponse.json({ error: "reportId and action are required" }, { status: 400 });`
- [route.ts:L84] Guard: `return NextResponse.json({ error: "Invalid action" }, { status: 400 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

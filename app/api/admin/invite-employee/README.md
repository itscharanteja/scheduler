# App / Api / Admin / Invite-employee

## Overview
Server-side API route handler servicing `/api/admin/invite-employee` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:POST] (function)

## Invariants
- [route.ts:L42] Guard: `if (!user) return null;`
- [route.ts:L66] Guard: `return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
- [route.ts:L72] Guard: `return NextResponse.json({ error: "employeeId is required" }, { status: 400 });`
- [route.ts:L84] Guard: `return NextResponse.json({ error: "Database error" }, { status: 500 });`
- [route.ts:L110] Guard: `return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
- [route.ts:L117] Guard: `return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });`
- [route.ts:L125] Guard: `{ status: 400 },`
- [route.ts:L137] Guard: `{ status: 403 },`
- [route.ts:L157] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

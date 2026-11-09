# App / Api / Feed / [id] / Comments

## Overview
Server-side API route handler servicing `/api/feed/[id]/comments` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:POST] (function)

## Invariants
- [route.ts:L40] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L54] Guard: `return NextResponse.json({ error: "Database error" }, { status: 500 });`
- [route.ts:L66] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L74] Guard: `return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });`
- [route.ts:L78] Guard: `if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });`
- [route.ts:L89] Guard: `return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

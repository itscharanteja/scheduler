# App / Api / Feed / [id] / Report

## Overview
Server-side API route handler servicing `/api/feed/[id]/report` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L15] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L23] Guard: `return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });`
- [route.ts:L47] Guard: `return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

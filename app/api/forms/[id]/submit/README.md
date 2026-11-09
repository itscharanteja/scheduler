# App / Api / Forms / [id] / Submit

## Overview
Server-side API route handler servicing `/api/forms/[id]/submit` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L28] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L50] Guard: `return NextResponse.json({ error: "Invalid request body." }, { status: 400 });`
- [route.ts:L55] Guard: `return NextResponse.json({ error: "date is required." }, { status: 400 });`
- [route.ts:L69] Guard: `return NextResponse.json({ error: "Failed to submit form." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

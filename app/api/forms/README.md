# App / Api / Forms

## Overview
Server-side API route handler servicing `/api/forms` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:POST] (function)
- Subdirectories:
  - [[id]]([id]/README.md)

## Invariants
- [route.ts:L22] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L30] Guard: `return NextResponse.json({ error: "Failed to load forms." }, { status: 500 });`
- [route.ts:L47] Guard: `return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });`
- [route.ts:L54] Guard: `return NextResponse.json({ error: "Invalid request body." }, { status: 400 });`
- [route.ts:L59] Guard: `return NextResponse.json({ error: "Form name is required." }, { status: 400 });`
- [route.ts:L67] Guard: `return NextResponse.json({ error: "Failed to create form." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

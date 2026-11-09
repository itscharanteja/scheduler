# App / Api / Forms / [id]

## Overview
Server-side API route handler servicing `/api/forms/[id]` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:PUT] (function)
- [route.ts:DELETE] (function)
- Subdirectories:
  - [submissions](submissions/README.md)
  - [submit](submit/README.md)

## Invariants
- [route.ts:L30] Guard: `return NextResponse.json({ error: "Failed to load form." }, { status: 500 });`
- [route.ts:L50] Guard: `return NextResponse.json({ error: "Invalid request body." }, { status: 400 });`
- [route.ts:L58] Guard: `return NextResponse.json({ error: "Failed to update form." }, { status: 500 });`
- [route.ts:L78] Guard: `return NextResponse.json({ error: "Failed to delete form." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

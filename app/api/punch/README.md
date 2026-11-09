# App / Api / Punch

## Overview
Server-side API route handler servicing `/api/punch` endpoints.

## Interface
- [route.ts:POST] (function)
- Subdirectories:
  - [employees](employees/README.md)
  - [status](status/README.md)

## Invariants
- [route.ts:L21] Guard: `return NextResponse.json({ error: "Invalid request body." }, { status: 400 });`
- [route.ts:L29] Guard: `{ status: 400 },`
- [route.ts:L34] Guard: `return NextResponse.json({ error: "action must be clock_in or clock_out." }, { status: 400 });`
- [route.ts:L46] Precondition error check: `if (empError) throw empError;`
- [route.ts:L72] Guard: `return NextResponse.json({ error: "Punch action failed." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

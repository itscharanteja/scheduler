# App / Api / Settings

## Overview
Server-side API route handler servicing `/api/settings` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:PUT] (function)

## Invariants
- [route.ts:L50] Guard: `return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

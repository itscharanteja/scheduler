# App / Api / Shift-logs / Flagged

## Overview
Server-side API route handler servicing `/api/shift-logs/flagged` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L24] Guard: `{ status: 400 },`
- [route.ts:L41] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

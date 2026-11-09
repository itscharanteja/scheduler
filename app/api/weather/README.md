# App / Api / Weather

## Overview
Server-side API route handler servicing `/api/weather` endpoints.

## Interface
- [route.ts:GET] (function)
- Subdirectories:
  - [refresh](refresh/README.md)

## Invariants
- [route.ts:L74] Guard: `{ status: 403 },`
- [route.ts:L151] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

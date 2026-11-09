# App / Api / Shift-logs / Summary

## Overview
Server-side API route handler servicing `/api/shift-logs/summary` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L27] Guard: `{ status: 400 },`
- [route.ts:L34] Guard: `{ status: 500 },`
- [route.ts:L49] Precondition error check: `if (error) throw error;`
- [route.ts:L115] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

# App / Api / Weather / Refresh

## Overview
Server-side API route handler servicing `/api/weather/refresh` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L33] Guard: `{ status: 403 },`
- [route.ts:L76] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

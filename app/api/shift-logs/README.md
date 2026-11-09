# App / Api / Shift-logs

## Overview
Server-side API route handler servicing `/api/shift-logs` endpoints.

## Interface
- [route.ts:GET] (function)
- Subdirectories:
  - [by-date](by-date/README.md)
  - [create](create/README.md)
  - [flagged](flagged/README.md)
  - [summary](summary/README.md)
  - [update](update/README.md)

## Invariants
- [route.ts:L23] Guard: `{ status: 400 },`
- [route.ts:L39] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

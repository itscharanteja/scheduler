# App / Api / Chat / Pinned

## Overview
Server-side API route handler servicing `/api/chat/pinned` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L21] Guard: `{ status: 400 },`
- [route.ts:L28] Guard: `{ status: 500 },`
- [route.ts:L39] Precondition error check: `if (error) throw error;`
- [route.ts:L84] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

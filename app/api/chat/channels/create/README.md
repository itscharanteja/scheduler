# App / Api / Chat / Channels / Create

## Overview
Server-side API route handler servicing `/api/chat/channels/create` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L33] Guard: `{ status: 400 },`
- [route.ts:L40] Guard: `{ status: 500 },`
- [route.ts:L64] Precondition error check: `throw error;`
- [route.ts:L89] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

# App / Api / Chat / Channels

## Overview
Server-side API route handler servicing `/api/chat/channels` endpoints.

## Interface
- [route.ts:GET] (function)
- Subdirectories:
  - [[id]]([id]/README.md)
  - [create](create/README.md)

## Invariants
- [route.ts:L21] Guard: `{ status: 400 },`
- [route.ts:L34] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

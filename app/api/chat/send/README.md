# App / Api / Chat / Send

## Overview
Server-side API route handler servicing `/api/chat/send` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L19] Guard: `{ status: 403 },`
- [route.ts:L30] Guard: `{ status: 400 },`
- [route.ts:L37] Guard: `{ status: 400 },`
- [route.ts:L50] Guard: `{ status: 500 },`
- [route.ts:L59] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

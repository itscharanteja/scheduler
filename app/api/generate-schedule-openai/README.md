# App / Api / Generate-schedule-openai

## Overview
Server-side API route handler servicing `/api/generate-schedule-openai` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L306] Guard: `{ status: 500 },`
- [route.ts:L327] Guard: `{ status: 400 },`
- [route.ts:L450] Guard: `{ status: 500 },`
- [route.ts:L465] Guard: `{ status: 500 },`
- [route.ts:L481] Guard: `{ status: 400 },`
- [route.ts:L537] Guard: `{ status: 400 },`
- [route.ts:L549] Guard: `{ status: 500 },`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

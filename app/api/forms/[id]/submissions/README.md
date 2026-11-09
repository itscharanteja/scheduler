# App / Api / Forms / [id] / Submissions

## Overview
Server-side API route handler servicing `/api/forms/[id]/submissions` endpoints.

## Interface
- [route.ts:GET] (function)
- Subdirectories:
  - [[submissionId]]([submissionId]/README.md)

## Invariants
- [route.ts:L38] Guard: `return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

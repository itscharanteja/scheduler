# App / Api / Forms / [id] / Submissions / [submissionid]

## Overview
Server-side API route handler servicing `/api/forms/[id]/submissions/[submissionId]` endpoints.

## Interface
- [route.ts:GET] (function)

## Invariants
- [route.ts:L29] Guard: `return NextResponse.json({ error: "Failed to load submission." }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

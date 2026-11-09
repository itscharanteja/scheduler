# App / Api / Feed / [id]

## Overview
Server-side API route handler servicing `/api/feed/[id]` endpoints.

## Interface
- [route.ts:DELETE] (function)
- Subdirectories:
  - [comments](comments/README.md)
  - [like](like/README.md)
  - [report](report/README.md)

## Invariants
- [route.ts:L14] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L37] Guard: `return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
- [route.ts:L47] Guard: `return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

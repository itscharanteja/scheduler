# App / Api / Feed

## Overview
Server-side API route handler servicing `/api/feed` endpoints.

## Interface
- [_helpers.ts:makeAdminClient] (function)
- [_helpers.ts:CallerInfo] (type)
- [_helpers.ts:getCallerInfo] (function)
- [_helpers.ts:isAdminRole] (function)
- [_helpers.ts:MappedPost] (type)
- [_helpers.ts:resolveDisplayName] (function)
- [_helpers.ts:mapPost] (function)
- [route.ts:GET] (function)
- [route.ts:POST] (function)
- Subdirectories:
  - [[id]]([id]/README.md)
  - [reports](reports/README.md)

## Invariants
- [_helpers.ts:L26] Guard: `if (!user) return null;`
- [route.ts:L16] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L34] Guard: `return NextResponse.json({ error: "Database error" }, { status: 500 });`
- [route.ts:L153] Guard: `if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- [route.ts:L159] Guard: `return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });`
- [route.ts:L165] Guard: `return NextResponse.json({ error: "Content is required" }, { status: 400 });`
- [route.ts:L184] Guard: `return NextResponse.json({ error: "Failed to create post" }, { status: 500 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

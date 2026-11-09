# App / Api / Notifications

## Overview
Server-side API route handler servicing `/api/notifications` endpoints.

## Interface
- [route.ts:GET] (function)
- [route.ts:POST] (function)
- [route.ts:PATCH] (function)
- [route.ts:DELETE] (function)

## Invariants
- [route.ts:L118] Guard: `return NextResponse.json({ error: "type, title and message are required." }, { status: 400 });`
- [route.ts:L132] Guard: `return NextResponse.json({ error: "Invalid notification payload." }, { status: 400 });`
- [route.ts:L147] Guard: `return NextResponse.json({ error: "id is required when markAllRead is false." }, { status: 400 });`
- [route.ts:L157] Guard: `return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

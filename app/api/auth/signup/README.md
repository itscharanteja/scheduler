# App / Api / Auth / Signup

## Overview
Server-side API route handler servicing `/api/auth/signup` endpoints.

## Interface
- [route.ts:POST] (function)

## Invariants
- [route.ts:L19] Guard: `return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });`
- [route.ts:L27] Guard: `{ status: 400 }`
- [route.ts:L34] Guard: `{ status: 400 }`
- [route.ts:L55] Guard: `{ status: 403 }`
- [route.ts:L68] Guard: `if (authError || !authData?.user) {`
- [route.ts:L69] Guard: `if (authError?.message?.toLowerCase().includes("already registered")) {`
- [route.ts:L78] Guard: `{ status: 500 }`

## Side Effects
- None

## Verification
- Run: `npm run lint` or `npm run build`

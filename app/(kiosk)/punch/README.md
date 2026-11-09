# App / (kiosk) / Punch

## Overview
Kiosk terminal views for staff clock-in/punch operations.

## Interface
- [page.tsx:function] (default)

## Invariants
- [page.tsx:L52] Precondition error check: `if (!empRes.ok) throw new Error("Failed to load employees");`
- [page.tsx:L102] Precondition error check: `throw new Error(body.error ?? "Punch failed");`

## Side Effects
- [page.tsx:L51] External HTTP call (`fetch`)
- [page.tsx:L59] External HTTP call (`fetch`)
- [page.tsx:L94] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

# App / (dashboard) / Attendance

## Overview
Dashboard application page and layout components for `attendance`.

## Interface
- [page.tsx:function] (default)

## Invariants
- [page.tsx:L72] Precondition error check: `if (!res.ok) throw new Error("Failed to load");`
- [page.tsx:L141] Precondition error check: `if (!res.ok) throw new Error("Failed to save");`

## Side Effects
- [page.tsx:L71] External HTTP call (`fetch`)
- [page.tsx:L136] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

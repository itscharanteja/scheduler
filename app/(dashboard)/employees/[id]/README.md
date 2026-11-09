# App / (dashboard) / Employees / [id]

## Overview
Dashboard application page and layout components for `employees/[id]`.

## Interface
- [page.tsx:function] (default)

## Invariants
- [page.tsx:L104] Precondition error check: `if (!res.ok) throw new Error(data.error ?? "Failed to send invite");`

## Side Effects
- [page.tsx:L73] External HTTP call (`fetch`)
- [page.tsx:L93] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

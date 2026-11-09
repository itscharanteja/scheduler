# App / (dashboard) / Forms / [id] / Submissions

## Overview
Dashboard application page and layout components for `forms/[id]/submissions`.

## Interface
- [page.tsx:function] (default)

## Invariants
- [page.tsx:L62] Precondition error check: `if (!res.ok) throw new Error("Failed to load");`
- [page.tsx:L97] Precondition error check: `if (!res.ok) throw new Error("Failed");`

## Side Effects
- [page.tsx:L61] External HTTP call (`fetch`)
- [page.tsx:L75] External HTTP call (`fetch`)
- [page.tsx:L96] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

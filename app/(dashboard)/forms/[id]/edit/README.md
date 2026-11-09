# App / (dashboard) / Forms / [id] / Edit

## Overview
Dashboard application page and layout components for `forms/[id]/edit`.

## Interface
- [page.tsx:function] (default)

## Invariants
- [page.tsx:L417] Precondition error check: `if (!res.ok) throw new Error("Not found");`
- [page.tsx:L496] Precondition error check: `if (!res.ok) throw new Error("Save failed");`

## Side Effects
- [page.tsx:L416] External HTTP call (`fetch`)
- [page.tsx:L480] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

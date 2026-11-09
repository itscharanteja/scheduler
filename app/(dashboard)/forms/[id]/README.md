# App / (dashboard) / Forms / [id]

## Overview
Dashboard application page and layout components for `forms/[id]`.

## Interface
- [page.tsx:function] (default)
- Subdirectories:
  - [edit](edit/README.md)
  - [submissions](submissions/README.md)

## Invariants
- [page.tsx:L173] Precondition error check: `if (!res.ok) throw new Error("Not found");`
- [page.tsx:L263] Precondition error check: `if (!res.ok) throw new Error("Submit failed");`

## Side Effects
- [page.tsx:L172] External HTTP call (`fetch`)
- [page.tsx:L198] External HTTP call (`fetch`)
- [page.tsx:L205] External HTTP call (`fetch`)
- [page.tsx:L258] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

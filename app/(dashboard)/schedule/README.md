# App / (dashboard) / Schedule

## Overview
Dashboard application page and layout components for `schedule`.

## Interface
- [page.tsx:function] (default)
- Subdirectories:
  - [day](day/README.md)

## Invariants
- [page.tsx:L992] Guard: `if (!session) return "no-punch";`

## Side Effects
- [page.tsx:L589] External HTTP call (`fetch`)
- [page.tsx:L609] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

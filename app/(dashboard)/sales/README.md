# App / (dashboard) / Sales

## Overview
Dashboard application page and layout components for `sales`.

## Interface
- [page.tsx:function] (default)

## Invariants
- [page.tsx:L69] Precondition error check: `if (!res.ok) throw new Error("Failed to fetch simulation status");`

## Side Effects
- [page.tsx:L68] External HTTP call (`fetch`)
- [page.tsx:L184] External HTTP call (`fetch`)
- [page.tsx:L200] External HTTP call (`fetch`)
- [page.tsx:L220] External HTTP call (`fetch`)
- [page.tsx:L237] External HTTP call (`fetch`)
- [page.tsx:L254] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

# Hooks

## Overview
React client hooks providing stateful integrations for UI components.

## Interface
- [use-ai-agent.ts:GeneratedShift] (type)
- [use-ai-agent.ts:GenerationResult] (type)
- [use-ai-agent.ts:useAIAgent] (function)

## Invariants
- [use-ai-agent.ts:L188] Precondition error check: `throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to generate schedule.")`
- [use-ai-agent.ts:L254] Precondition error check: `throw new Error(firstError?.reason?.message ?? "No shifts could be saved.");`

## Side Effects
- [use-ai-agent.ts:L166] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

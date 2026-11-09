# Context

## Overview
React Context providers managing client-side application state across view trees.

## Interface
- [AuthContext.tsx:UserRole] (type)
- [AuthContext.tsx:AuthUser] (interface)
- [AuthContext.tsx:AuthProvider] (function)
- [AuthContext.tsx:useAuth] (function)
- [LanguageContext.tsx:LanguageProvider] (function)
- [LanguageContext.tsx:useLanguage] (function)
- [LocationContext.tsx:LocationProvider] (function)
- [LocationContext.tsx:useLocation] (function)

## Invariants
- [AuthContext.tsx:L78] Guard: `if (!session) {`
- [AuthContext.tsx:L138] Guard: `if (!user) return false;`
- [AuthContext.tsx:L153] Precondition error check: `if (!ctx) throw new Error("useAuth must be used within AuthProvider");`
- [LanguageContext.tsx:L296] Precondition error check: `throw new Error("useLanguage must be used within a LanguageProvider");`
- [LocationContext.tsx:L67] Precondition error check: `if (!ctx) throw new Error("useLocation must be used within LocationProvider");`

## Side Effects
- [LanguageContext.tsx:L262] Browser LocalStorage persistence
- [LanguageContext.tsx:L269] Browser LocalStorage persistence
- [LocationContext.tsx:L44] Browser LocalStorage persistence
- [LocationContext.tsx:L54] Browser LocalStorage persistence

## Verification
- Run: `npm run lint` or `npm run build`

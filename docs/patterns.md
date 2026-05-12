# Coding Patterns

Quick reference for patterns every new session must follow.

## API Route pattern

```typescript
import { getCallerSession, hasRole, resolveLocationId, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();                          // 401
  if (!hasRole(caller, "admin", "super_admin")) return forbidden(); // 403
  const locationId = resolveLocationId(caller, req.nextUrl.searchParams.get("locationId"));
  // ...
  return NextResponse.json({ data }, { status: 200 });
}
```

- Success: `{ data }` + `200/201`
- Error: `{ error: "message" }` + `400/403/404/500`
- Writes that bypass RLS: use `serviceClient()` from `lib/api-auth`

## Data layer pattern (`lib/supabase/<domain>.ts`)

```typescript
import { supabaseClient, requireClient } from "./client";

// Reads — use supabaseClient (anon), guard against undefined
export async function getThings(locationId: string) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient.from("things").select("*").eq("location_id", locationId);
  if (error) throw error;
  return (data as DbThingRow[]).map(mapThing);
}

// Writes — use requireClient() (throws if not configured)
export async function createThing(payload: ...) {
  const client = requireClient();
  const { data, error } = await client.from("things").insert({...}).select("*").single();
  if (error) throw error;
  return mapThing(data as DbThingRow);
}
```

- Hand-write `DbXxxRow` types — no Supabase codegen
- Map snake_case DB → camelCase app in a `mapXxx()` function
- Export from `lib/supabase/index.ts` barrel

## Page pattern

```typescript
"use client";
// All dashboard pages are client components
// Auth guard: useEffect redirect or early return based on hasRole()
// Location scope: const { locationId } = useLocation()
// Language: const { lang } = useLanguage()
// Toast feedback: toast.success / toast.error from "sonner"
// Form state: plain useState, no react-hook-form
// Dialogs: shadcn Dialog component
```

## DB migrations

- Permissive RLS: `using (true)` / `with check (true)` — access control at API layer
- Always: `enable row level security` + policies for select/insert/update/delete
- No delete policy on audit tables (submissions, responses)
- FK cascade: `on delete cascade` for child rows, `on delete set null` for soft refs

## Adding a nav item

In `components/app-shell.tsx`:
1. Import icon from `lucide-react`
2. Add to `navItems` array with `roles` if role-gated
3. Add to `getPageMeta()` with title + subtitle in both `sv` and `en`

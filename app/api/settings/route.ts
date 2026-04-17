import { NextRequest, NextResponse } from "next/server";
import type { SettingsPayload } from "@/lib/types";
import { getDefaultSettings, getRuntimeStore } from "@/lib/server/runtime-store";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

function normalizeSettings(input: Partial<SettingsPayload>): SettingsPayload {
  const defaults = getDefaultSettings();
  return {
    userPreferences: {
      ...defaults.userPreferences,
      ...(input.userPreferences ?? {}),
    },
    notificationPreferences: {
      ...defaults.notificationPreferences,
      ...(input.notificationPreferences ?? {}),
    },
    workingHours: {
      ...defaults.workingHours,
      ...(input.workingHours ?? {}),
    },
    timezone: typeof input.timezone === "string" ? input.timezone : defaults.timezone,
    aiPreferences: {
      ...defaults.aiPreferences,
      ...(input.aiPreferences ?? {}),
    },
  };
}

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  const store = getRuntimeStore();
  return NextResponse.json({ settings: store.settings });
}

export async function PUT(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const body = (await req.json()) as Partial<SettingsPayload>;
    const normalized = normalizeSettings(body);
    const store = getRuntimeStore();
    store.settings = normalized;
    return NextResponse.json({ settings: store.settings });
  } catch {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }
}

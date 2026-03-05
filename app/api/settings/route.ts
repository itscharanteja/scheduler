import { NextResponse } from "next/server";
import type { SettingsPayload } from "@/lib/types";
import { getDefaultSettings, getRuntimeStore } from "@/lib/server/runtime-store";

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

export async function GET() {
  const store = getRuntimeStore();
  return NextResponse.json({ settings: store.settings });
}

export async function PUT(req: Request) {
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

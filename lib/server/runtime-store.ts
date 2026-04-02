import { mockEmployees, mockShifts } from "@/lib/mock-data";
import type { AppNotification, Employee, SettingsPayload, Shift } from "@/lib/types";

const DEFAULT_SETTINGS: SettingsPayload = {
  userPreferences: {
    compactMode: false,
    weekStartsOnMonday: true,
  },
  notificationPreferences: {
    shiftAssigned: true,
    shiftUpdated: true,
    shiftConflict: true,
    aiSuggestion: true,
  },
  workingHours: {
    start: "09:00",
    end: "17:00",
  },
  timezone: "Europe/Stockholm",
  aiPreferences: {
    optimizeForFairness: true,
    avoidOvertime: true,
    assistantTone: "balanced",
  },
};

type RuntimeStore = {
  settings: SettingsPayload;
  notifications: AppNotification[];
  readNotificationIds: string[];
  employees: Employee[];
  shifts: Shift[];
};

declare global {
  var __SKIFT_RUNTIME_STORE__: RuntimeStore | undefined;
}

function initialStore(): RuntimeStore {
  return {
    settings: DEFAULT_SETTINGS,
    notifications: [],
    readNotificationIds: [],
    employees: mockEmployees,
    shifts: mockShifts,
  };
}

export function getRuntimeStore(): RuntimeStore {
  if (!globalThis.__SKIFT_RUNTIME_STORE__) {
    globalThis.__SKIFT_RUNTIME_STORE__ = initialStore();
  }
  return globalThis.__SKIFT_RUNTIME_STORE__;
}

export function getDefaultSettings(): SettingsPayload {
  return DEFAULT_SETTINGS;
}

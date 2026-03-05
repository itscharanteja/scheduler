export type EmploymentType = "full-time" | "part-time" | "hourly";

export interface Employee {
  id: string;
  name: string;
  role: string;
  contractHours: number;
  maxWeeklyHours: number;
  employmentType: EmploymentType;
  phone: string;
  locationId: string;
  createdAt: string;
  hourlyRate?: number;
}

export type ShiftStatus = "draft" | "published";

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  status: ShiftStatus;
  createdByAi?: boolean;
  notes?: string;
}

export interface WeekSchedule {
  weekStart: string;
  locationId: string;
  shifts: Shift[];
  status: ShiftStatus;
}

export interface Location {
  id: string;
  name: string;
  address: string;
}

export type SettingsPayload = {
  userPreferences: {
    compactMode: boolean;
    weekStartsOnMonday: boolean;
  };
  notificationPreferences: {
    shiftAssigned: boolean;
    shiftUpdated: boolean;
    shiftConflict: boolean;
    aiSuggestion: boolean;
  };
  workingHours: {
    start: string;
    end: string;
  };
  timezone: string;
  aiPreferences: {
    optimizeForFairness: boolean;
    avoidOvertime: boolean;
    assistantTone: "concise" | "balanced" | "detailed";
  };
};

export type NotificationKind =
  | "shift_assigned"
  | "shift_updated"
  | "shift_conflict"
  | "ai_suggestion";

export interface AppNotification {
  id: string;
  type: NotificationKind;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

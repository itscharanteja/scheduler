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
  city?: string;
  managerName?: string;
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

export type AlertTone = "success" | "warning" | "critical" | "info";

export interface WeatherForecastDay {
  date: string;
  condition: "sunny" | "partly-cloudy" | "cloudy" | "rain" | "windy" | "snow";
  summary: string;
  tempHigh: number;
  tempLow: number;
  precipitationChance: number;
  windKph: number;
}

export interface SalesDay {
  id: string;
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  laborCost: number;
  comparisonRevenue: number;
  peakLabel: string;
  hourlyRevenue: number[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  locationId: string;
  stockLevel: number;
  threshold: number;
  unit: string;
  status: "healthy" | "watch" | "critical";
  updatedAt: string;
  updatedBy: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  unreadCount: number;
  participantCount: number;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  content: string;
  timestamp: string;
  mine?: boolean;
}

export interface ShiftLeaderLogEntry {
  id: string;
  title: string;
  note: string;
  category: "ops" | "staff" | "stock" | "guest";
  priority: "low" | "medium" | "high";
  status: "open" | "delegated" | "done";
  assigneeId?: string;
  assigneeName?: string;
  dueTime?: string;
  createdAt: string;
  completedAt?: string;
}

export interface EmployeeActivityItem {
  id: string;
  employeeId: string;
  type: "shift" | "stock" | "message" | "task" | "attendance";
  title: string;
  detail: string;
  timestamp: string;
}

export interface DashboardAlert {
  id: string;
  tone: AlertTone;
  title: string;
  message: string;
}

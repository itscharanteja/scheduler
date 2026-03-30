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
  position?: "GM" | "AM" | "SL" | "TM";
  contractPercent?: number;
  monthlyHours?: number;
  monthlySalary?: number;
  labourCostPerHour?: number;
  bio?: string;
  avatarUrl?: string;
  joinedDate?: string;
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

// ─────────────────────────────────────────────────
// Sales Module
// ─────────────────────────────────────────────────

export interface Sale {
  id: string;
  locationId: string;
  date: string;
  hour: number;
  revenueSek: number;
  orderCount: number;
  createdAt: string;
}

export interface SalesSummary {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  peakHour: number;
  peakRevenue: number;
  hourlyBreakdown: {
    hour: number;
    revenue: number;
    orders: number;
  }[];
}

export interface WeeklySalesSummary {
  weekStart: string;
  totalRevenue: number;
  totalOrders: number;
  dailyBreakdown: {
    date: string;
    day: string;
    revenue: number;
    orders: number;
    vsLastWeek: number;
  }[];
  bestDay: string;
  bestDayRevenue: number;
  estimatedLabourCost?: number;
}

// ─────────────────────────────────────────────────
// Inventory Module
// ─────────────────────────────────────────────────

export type InventoryStatus = "ok" | "low" | "critical";
export type InventoryCategory =
  | "food"
  | "drinks"
  | "packaging"
  | "cleaning";

export interface InventoryItem {
  id: string;
  locationId: string;
  itemName: string;
  category: InventoryCategory;
  currentStock: number;
  unit: string;
  lowThreshold: number;
  criticalThreshold: number;
  lastUpdated: string;
  updatedBy?: string;
  status: InventoryStatus;
}

export interface InventoryUpdatePayload {
  id: string;
  newStock: number;
  updatedBy: string;
}

// ─────────────────────────────────────────────────
// Shift Logs Module
// ─────────────────────────────────────────────────

export type ShiftType = "morning" | "lunch" | "evening" | "full";

export interface ShiftLog {
  id: string;
  locationId: string;
  shiftLeaderId: string;
  shiftLeaderName?: string;
  date: string;
  shiftType: ShiftType;
  notes: string;
  issuesFlagged: boolean;
  tasksCompleted: string[];
  tasksPending: string[];
  createdAt: string;
}

export interface CreateShiftLogPayload {
  locationId: string;
  shiftLeaderId: string;
  date: string;
  shiftType: ShiftType;
  notes: string;
  issuesFlagged: boolean;
  tasksCompleted: string[];
  tasksPending: string[];
}

// ─────────────────────────────────────────────────
// Chat Module
// ─────────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  locationId: string;
  name: string;
  slug: string;
  description?: string;
  isAnnouncement: boolean;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderPosition?: string;
  message: string;
  isPinned: boolean;
  createdAt: string;
}

export interface SendMessagePayload {
  channelId: string;
  senderId: string;
  message: string;
}

// ─────────────────────────────────────────────────
// Weather Module
// ─────────────────────────────────────────────────

export type WeatherCondition =
  | "Clear"
  | "Clouds"
  | "Rain"
  | "Drizzle"
  | "Snow"
  | "Thunderstorm";

export interface WeatherForecast {
  id: string;
  locationId: string;
  forecastDate: string;
  day: string;
  temperatureHigh: number;
  temperatureLow: number;
  condition: WeatherCondition;
  rainProbability: number;
  windSpeed: number;
  uvIndex: number;
  staffingSuggestion: string;
  inventorySuggestion: string;
  fetchedAt: string;
}

export interface WeatherSuggestion {
  date: string;
  day: string;
  condition: WeatherCondition;
  icon: string;
  staffingDelta: number;
  staffingReason: string;
  recommendedStaff: number;
  inventoryAlerts: string[];
}

// ─────────────────────────────────────────────────
// Dashboard Module
// ─────────────────────────────────────────────────

export interface DashboardSummary {
  todayRevenue: number;
  todayOrders: number;
  vsYesterday: number;
  lowStockCount: number;
  criticalStockCount: number;
  todayStaffCount: number;
  flaggedLogsCount: number;
  unreadMessagesCount: number;
  weatherSummary?: string;
}

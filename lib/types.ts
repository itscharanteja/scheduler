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

export type WeatherCondition = "Clear" | "Clouds" | "Rain" | "Drizzle" | "Snow" | "Thunderstorm";

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
  inventorySuggestion?: string;
  fetchedAt: string;
}

export interface WeatherSuggestion {
  date: string;
  day: string;
  condition: string;
  icon: string;
  staffingDelta: number;
  staffingReason: string;
  recommendedStaff: number;
  inventoryAlerts: string[];
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
  locationId: string;
  name: string;
  slug: string;
  description?: string;
  isAnnouncement: boolean;
  createdAt: string;
  createdBy?: string;
  unreadCount?: number;
  participantCount?: number;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  content: string;
  timestamp: string;
  isPinned?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  mine?: boolean;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  addedAt: string;
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

export type ShiftType = "morning" | "lunch" | "evening" | "full";

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

export interface ShiftLog {
  id: string;
  locationId: string;
  date: string;
  shiftLeaderId: string;
  shiftLeaderName?: string;
  shiftType: ShiftType;
  notes: string;
  issuesFlagged: boolean;
  tasksCompleted: string[];
  tasksPending: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkTitle?: string | null;
  repostOf?: FeedPost | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface FeedReport {
  id: string;
  postId: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  postContent?: string;
  postAuthorName?: string;
}

// ─── Custom Forms ─────────────────────────────────────────────────────────────

export type FieldType = "text" | "number" | "checkbox" | "date" | "select";

export type TextFieldConfig = {
  type: "text";
  placeholder?: string;
  multiline?: boolean;
};

export type NumberFieldConfig = {
  type: "number";
  min?: number;
  max?: number;
  unit?: string;
};

export type CheckboxFieldConfig = {
  type: "checkbox";
};

export type DateFieldConfig = {
  type: "date";
};

export type SelectFieldConfig = {
  type: "select";
  options?: string[];
  linked_source?: "employees" | "inventory";
};

export type FieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | CheckboxFieldConfig
  | DateFieldConfig
  | SelectFieldConfig;

export interface CustomFormField {
  id: string;
  formId: string;
  label: string;
  fieldType: FieldType;
  config: FieldConfig;
  orderIndex: number;
  isRequired: boolean;
  createdAt: string;
}

export interface CustomForm {
  id: string;
  locationId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  fieldCount?: number;
  lastSubmittedAt?: string | null;
}

export interface CustomFormWithFields extends CustomForm {
  fields: CustomFormField[];
}

export interface CustomFormSubmission {
  id: string;
  formId: string;
  locationId: string;
  submittedBy: string | null;
  submittedByName?: string | null;
  date: string;
  createdAt: string;
}

export interface FormResponse {
  id: string;
  submissionId: string;
  fieldId: string;
  fieldLabel?: string;
  value: unknown;
  createdAt: string;
}

export interface CustomFormSubmissionWithResponses extends CustomFormSubmission {
  responses: FormResponse[];
}

export interface DraftFieldInput {
  label: string;
  fieldType: FieldType;
  config: FieldConfig;
  orderIndex: number;
  isRequired: boolean;
}

export interface UpdateFormPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
  fields?: DraftFieldInput[];
}

export interface SubmitFormPayload {
  date: string;
  responses: Array<{ fieldId: string; value: unknown }>;
}

export { supabaseClient, isSupabaseConfigured, requireClient, normalizeSupabaseError } from "./client";
export { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "./employees";
export type { CreateEmployeeInput, UpdateEmployeeInput } from "./employees";
export { getLocations } from "./locations";
export { getShiftsByWeek, getShiftsByMonth, createShift, updateShift, deleteShift } from "./shifts";
export type { CreateShiftInput, UpdateShiftInput } from "./shifts";
export {
  getChannels,
  sendMessage,
  getMessages,
  pinMessage,
  editMessage,
  deleteMessage,
  getChannelMembers,
  addChannelMember,
  removeChannelMember,
} from "./chat";
export { getTasks, createTask, updateTask, deleteTask } from "./tasks";
export { getShiftLogs, createShiftLog, updateShiftLog, getShiftLogsByDate, getFlaggedLogs } from "./shift-logs";
export { getInventory, getLowStockItems, updateInventoryItem } from "./inventory";
export { getSales } from "./sales";
export { getAlerts, resolveAlert } from "./alerts";
export { getActivity, getEmployeeActivity } from "./activity";
export { getCachedWeather, upsertWeatherForecast } from "./weather";
export {
  getChecklistTemplate,
  upsertChecklistTemplate,
  getChecklistSubmission,
  saveChecklistSubmission,
} from "./checklists";
export type { ChecklistTemplate, ChecklistSubmission } from "./checklists";
export {
  getEmployeesForKiosk,
  getActiveSession,
  clockIn,
  clockOut,
  getAttendanceSessions,
} from "./attendance";
export type { AttendanceSession, AttendanceSessionWithEmployee, KioskEmployee } from "./attendance";

# Lib / Supabase

## Overview
Core business logic, Supabase database client utilities, simulator helpers, and server utilities.

## Interface
- [activity.ts:getActivity] (function)
- [activity.ts:getEmployeeActivity] (function)
- [alerts.ts:getAlerts] (function)
- [alerts.ts:resolveAlert] (function)
- [attendance.ts:AttendanceSession] (type)
- [attendance.ts:KioskEmployee] (type)
- [attendance.ts:getEmployeesForKiosk] (function)
- [attendance.ts:getActiveSession] (function)
- [attendance.ts:clockIn] (function)
- [attendance.ts:updateAttendanceSession] (function)
- [attendance.ts:clockOut] (function)
- [attendance.ts:AttendanceSessionWithEmployee] (type)
- [attendance.ts:getAttendanceSessions] (function)
- [chat.ts:getChannels] (function)
- [chat.ts:sendMessage] (function)
- [chat.ts:getMessages] (function)
- [chat.ts:pinMessage] (function)
- [chat.ts:editMessage] (function)
- [chat.ts:deleteMessage] (function)
- [chat.ts:getChannelMembers] (function)
- [chat.ts:addChannelMember] (function)
- [chat.ts:removeChannelMember] (function)
- [checklists.ts:ChecklistTemplate] (interface)
- [checklists.ts:ChecklistSubmission] (interface)
- [checklists.ts:getChecklistTemplate] (function)
- [checklists.ts:upsertChecklistTemplate] (function)
- [checklists.ts:getChecklistSubmission] (function)
- [checklists.ts:saveChecklistSubmission] (function)
- [client.ts:supabaseClient] (const)
- [client.ts:isSupabaseConfigured] (const)
- [client.ts:normalizeSupabaseError] (function)
- [client.ts:requireClient] (function)
- [employees.ts:getEmployees] (function)
- [employees.ts:CreateEmployeeInput] (type)
- [employees.ts:createEmployee] (function)
- [employees.ts:UpdateEmployeeInput] (type)
- [employees.ts:updateEmployee] (function)
- [employees.ts:deleteEmployee] (function)
- [forms.ts:getForms] (function)
- [forms.ts:getForm] (function)
- [forms.ts:createForm] (function)
- [forms.ts:updateForm] (function)
- [forms.ts:deleteForm] (function)
- [forms.ts:submitForm] (function)
- [forms.ts:getFormSubmissions] (function)
- [forms.ts:getFormSubmission] (function)
- [index.ts:default] (type)
- [inventory.ts:AppInventoryItem] (interface)
- [inventory.ts:mapInventoryItem] (function)
- [inventory.ts:getInventory] (function)
- [inventory.ts:getLowStockItems] (function)
- [inventory.ts:updateInventoryItem] (function)
- [locations.ts:getLocations] (function)
- [sales.ts:getSales] (function)
- [shift-logs.ts:getShiftLogs] (function)
- [shift-logs.ts:createShiftLog] (function)
- [shift-logs.ts:updateShiftLog] (function)
- [shift-logs.ts:getShiftLogsByDate] (function)
- [shift-logs.ts:getFlaggedLogs] (function)
- [shifts.ts:getShiftsByWeek] (function)
- [shifts.ts:getShiftsByMonth] (function)
- [shifts.ts:CreateShiftInput] (type)
- [shifts.ts:createShift] (function)
- [shifts.ts:UpdateShiftInput] (type)
- [shifts.ts:updateShift] (function)
- [shifts.ts:deleteShift] (function)
- [tasks.ts:getTasks] (function)
- [tasks.ts:createTask] (function)
- [tasks.ts:updateTask] (function)
- [tasks.ts:deleteTask] (function)
- [weather.ts:getCachedWeather] (function)
- [weather.ts:upsertWeatherForecast] (function)

## Invariants
- [activity.ts:L34] Precondition error check: `if (error) throw error;`
- [activity.ts:L54] Precondition error check: `if (error) throw error;`
- [alerts.ts:L32] Precondition error check: `if (error) throw error;`
- [alerts.ts:L47] Precondition error check: `if (error) throw error;`
- [attendance.ts:L58] Precondition error check: `if (error) throw error;`
- [attendance.ts:L61] Precondition error check: `throw normalizeSupabaseError(error, "getEmployeesForKiosk");`
- [attendance.ts:L82] Precondition error check: `if (error) throw error;`
- [attendance.ts:L85] Precondition error check: `throw normalizeSupabaseError(error, "getActiveSession");`
- [attendance.ts:L99] Precondition error check: `if (error) throw error;`
- [attendance.ts:L102] Precondition error check: `throw normalizeSupabaseError(error, "clockIn");`
- [attendance.ts:L130] Precondition error check: `if (error) throw error;`
- [attendance.ts:L133] Precondition error check: `throw normalizeSupabaseError(error, "updateAttendanceSession");`
- [attendance.ts:L148] Precondition error check: `if (error) throw error;`
- [attendance.ts:L151] Precondition error check: `throw normalizeSupabaseError(error, "clockOut");`
- [attendance.ts:L191] Precondition error check: `if (error) throw error;`

## Side Effects
- [inventory.ts:L63] External HTTP call (`fetch`)
- [inventory.ts:L70] External HTTP call (`fetch`)
- [sales.ts:L58] External HTTP call (`fetch`)

## Verification
- Run: `npm run lint` or `npm run build`

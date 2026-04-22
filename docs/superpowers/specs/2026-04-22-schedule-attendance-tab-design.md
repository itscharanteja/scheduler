# Schedule Attendance Tab — Design Spec

## What
Add an "Attendance" tab to the Schedule page that shows each employee's scheduled shift alongside their actual punch-in/punch-out time for the selected day. Admins toggle between the existing Gantt ("Schedule") and the new card list ("Attendance").

## Four Card States
| State | Condition | Badge colour |
|-------|-----------|-------------|
| Complete | Has shift + clocked in and out | Green |
| Active shift | Has shift + currently clocked in | Amber |
| Not clocked in | Has shift, no punch recorded | Red |
| Unscheduled | Punched in but no shift | Blue |

## Architecture
- **Single file change**: `app/(dashboard)/schedule/page.tsx`
- Tab state: `useState<"schedule" | "attendance">` — local, no URL param
- Tab switcher: two-button toggle above the Gantt, visible when a day is selected
- New component `AttendanceTabView` added inline at the bottom of the file

## Data Flow
- Attendance fetch added to existing day-change `useEffect`: `GET /api/attendance/report?from=date&to=date&locationId=...`
- Sessions grouped into `Map<employeeId, AttendanceSession>`
- `AttendanceTabView` merges two sets:
  1. Employees with shifts on the selected day
  2. Employees with punch sessions but no shift (shown with "No shift scheduled")
- Sort order: shifted employees by start time first, then unscheduled alphabetically

## Component Props
```typescript
AttendanceTabView({
  employees: Employee[],
  dayShifts: Shift[],
  sessions: AttendanceSessionWithEmployee[],
})
```

## Files Modified
| File | Change |
|------|--------|
| `app/(dashboard)/schedule/page.tsx` | Add tab switcher, attendance fetch, AttendanceTabView component |

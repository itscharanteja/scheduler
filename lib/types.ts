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


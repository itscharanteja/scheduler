import type { Employee } from "./types";

// Swedish Arbetstidslagen (Labor Law) constants
const MAX_SHIFT_HOURS = 10;
const MIN_REST_HOURS = 11;
const MAX_WEEKLY_HOURS = 48;
const MAX_WEEKLY_HOURS_AVERAGE = 40;

export interface LawViolation {
  employeeId: string;
  employeeName: string;
  violationType:
    | "shift_too_long"
    | "insufficient_rest"
    | "weekly_hours_exceeded"
    | "contract_hours_exceeded";
  description: string;
  severity: "warning" | "critical";
  affectedDates: string[];
}

/**
 * Calculates shift duration in hours, handling midnight crossings.
 */
export function calculateShiftHours(
  startTime: string,
  endTime: string,
): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    return 0;
  }

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  let hours = (endMinutes - startMinutes) / 60;

  // Handle midnight crossing
  if (hours < 0) {
    hours += 24;
  }

  return Math.round(hours * 100) / 100;
}

/**
 * Validates that no shift exceeds 10 hours (Arbetstidslagen max shift duration).
 */
export function validateShiftLength(
  shifts: any[],
  employees: any[],
): LawViolation[] {
  const violations: LawViolation[] = [];

  for (const shift of shifts) {
    const hours = calculateShiftHours(shift.startTime, shift.endTime);

    if (hours > MAX_SHIFT_HOURS) {
      violations.push({
        employeeId: shift.employeeId,
        employeeName: shift.employeeName,
        violationType: "shift_too_long",
        description: `${shift.employeeName} has a ${hours.toFixed(1)}h shift on ${shift.date}. Maximum is ${MAX_SHIFT_HOURS}h under Arbetstidslagen.`,
        severity: "critical",
        affectedDates: [shift.date],
      });
    }
  }

  return violations;
}

/**
 * Validates that employees have at least 11 hours rest between consecutive shifts.
 */
export function validateRestPeriods(
  shifts: any[],
  employees: any[],
): LawViolation[] {
  const violations: LawViolation[] = [];

  // Group shifts by employee
  const shiftsByEmployee = new Map<string, any[]>();
  for (const shift of shifts) {
    if (!shiftsByEmployee.has(shift.employeeId)) {
      shiftsByEmployee.set(shift.employeeId, []);
    }
    shiftsByEmployee.get(shift.employeeId)!.push(shift);
  }

  // Check rest periods for each employee
  for (const [employeeId, employeeShifts] of shiftsByEmployee) {
    // Sort by date then start time
    employeeShifts.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });

    // Check consecutive shifts
    for (let i = 0; i < employeeShifts.length - 1; i++) {
      const shift1 = employeeShifts[i];
      const shift2 = employeeShifts[i + 1];

      // Create datetime objects
      const endDateTime = new Date(`${shift1.date}T${shift1.endTime}`);
      const startDateTime = new Date(`${shift2.date}T${shift2.startTime}`);

      // Calculate rest hours
      const restMs = startDateTime.getTime() - endDateTime.getTime();
      const restHours = restMs / (1000 * 60 * 60);

      if (restHours < MIN_REST_HOURS) {
        const employeeName =
          shift1.employeeName ||
          employees.find((e) => e.id === employeeId)?.name ||
          "Unknown";

        violations.push({
          employeeId,
          employeeName,
          violationType: "insufficient_rest",
          description: `${employeeName} has only ${restHours.toFixed(1)}h rest between shifts on ${shift1.date} and ${shift2.date}. Minimum is ${MIN_REST_HOURS}h under Arbetstidslagen.`,
          severity: "critical",
          affectedDates: [shift1.date, shift2.date],
        });
      }
    }
  }

  return violations;
}

/**
 * Validates weekly hour limits (48h max by law, or employee contract maximum).
 */
export function validateWeeklyHours(
  shifts: any[],
  employees: any[],
): LawViolation[] {
  const violations: LawViolation[] = [];

  // Group shifts by employee
  const shiftsByEmployee = new Map<string, any[]>();
  for (const shift of shifts) {
    if (!shiftsByEmployee.has(shift.employeeId)) {
      shiftsByEmployee.set(shift.employeeId, []);
    }
    shiftsByEmployee.get(shift.employeeId)!.push(shift);
  }

  // Check weekly hours for each employee
  for (const [employeeId, employeeShifts] of shiftsByEmployee) {
    const employee = employees.find((e) => e.id === employeeId);
    const employeeName =
      employeeShifts[0]?.employeeName || employee?.name || "Unknown";

    // Calculate total hours
    let totalHours = 0;
    for (const shift of employeeShifts) {
      totalHours += calculateShiftHours(shift.startTime, shift.endTime);
    }

    const affectedDates = employeeShifts.map((s) => s.date);

    // Check against legal maximum
    if (totalHours > MAX_WEEKLY_HOURS) {
      violations.push({
        employeeId,
        employeeName,
        violationType: "weekly_hours_exceeded",
        description: `${employeeName} is scheduled for ${totalHours.toFixed(1)}h this week. Maximum is ${MAX_WEEKLY_HOURS}h under Arbetstidslagen.`,
        severity: "critical",
        affectedDates,
      });
    } else if (
      employee &&
      totalHours > employee.maxWeeklyHours
    ) {
      // Check against contract maximum
      violations.push({
        employeeId,
        employeeName,
        violationType: "contract_hours_exceeded",
        description: `${employeeName} is scheduled for ${totalHours.toFixed(1)}h but their contract maximum is ${employee.maxWeeklyHours}h.`,
        severity: "warning",
        affectedDates,
      });
    }
  }

  return violations;
}

/**
 * Validates entire schedule against Swedish labor law.
 * Returns violations and validation summary.
 */
export function validateSchedule(
  shifts: any[],
  employees: any[],
): {
  violations: LawViolation[];
  criticalCount: number;
  warningCount: number;
  isValid: boolean;
  summary: string;
} {
  // Run all validators
  const shiftViolations = validateShiftLength(shifts, employees);
  const restViolations = validateRestPeriods(shifts, employees);
  const weeklyViolations = validateWeeklyHours(shifts, employees);

  // Combine all violations
  const allViolations = [
    ...shiftViolations,
    ...restViolations,
    ...weeklyViolations,
  ];

  // Count by severity
  const criticalCount = allViolations.filter(
    (v) => v.severity === "critical",
  ).length;
  const warningCount = allViolations.filter(
    (v) => v.severity === "warning",
  ).length;

  // Determine validity (no critical violations)
  const isValid = criticalCount === 0;

  // Build summary
  let summary = "";
  if (allViolations.length === 0) {
    summary =
      "Schedule complies with Swedish labor law (Arbetstidslagen). ✓";
  } else if (criticalCount === 0 && warningCount > 0) {
    summary = `${warningCount} contract hour warning(s). No legal violations.`;
  } else {
    summary = `${criticalCount} labor law violation(s) found. Please review before publishing.`;
  }

  return {
    violations: allViolations,
    criticalCount,
    warningCount,
    isValid,
    summary,
  };
}

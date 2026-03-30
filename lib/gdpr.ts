/**
 * Anonymises employee names for GDPR compliance before sending to Claude API.
 * Real names are mapped to generic identifiers (Staff_01, Staff_02, etc.)
 * Works with any object that has a 'name' property.
 */
export function anonymiseEmployees<T extends { name: string }>(
  employees: T[],
): {
  anonymised: T[];
  mapping: Map<string, string>;
} {
  const mapping = new Map<string, string>();
  const anonymised = employees.map((emp, index) => {
    const anonName = `Staff_${String(index + 1).padStart(2, "0")}`;
    mapping.set(anonName, emp.name);
    return {
      ...emp,
      name: anonName,
    };
  });

  return { anonymised, mapping };
}

/**
 * Anonymises shift employee names using the mapping from anonymiseEmployees.
 * Works with any object that has an 'employeeName' property.
 */
export function anonymiseShifts<T extends { employeeName?: string }>(
  shifts: T[],
  mapping: Map<string, string>,
): T[] {
  // Build reverse mapping: real name → anonymised name
  const reverseMapping = new Map<string, string>();
  mapping.forEach((realName, anonName) => {
    reverseMapping.set(realName, anonName);
  });

  return shifts.map((shift) => {
    const employeeName = shift.employeeName || "";
    const anonName = reverseMapping.get(employeeName) || employeeName;
    return {
      ...shift,
      employeeName: anonName || shift.employeeName,
    };
  });
}

/**
 * De-anonymises shifts by replacing anonymised names with real names.
 */
export function deAnonymiseShifts(
  shifts: any[],
  mapping: Map<string, string>,
): any[] {
  return shifts.map((shift) => {
    const realName = mapping.get(shift.employeeName) || shift.employeeName;
    return {
      ...shift,
      employeeName: realName,
    };
  });
}

/**
 * De-anonymises text by replacing all anonymised names with real names.
 * Case-insensitive replacement.
 */
export function deAnonymiseText(
  text: string,
  mapping: Map<string, string>,
): string {
  let result = text;
  mapping.forEach((realName, anonName) => {
    const regex = new RegExp(anonName, "gi");
    result = result.replace(regex, realName);
  });
  return result;
}

/**
 * De-anonymises the entire Claude response by replacing all anonymised names
 * with real names across all fields (shifts, explanation, warnings, insights, summary).
 */
export function deAnonymiseResponse(
  response: any,
  mapping: Map<string, string>,
): any {
  return {
    ...response,
    // De-anonymise shifts
    shifts: Array.isArray(response.shifts)
      ? deAnonymiseShifts(response.shifts, mapping)
      : response.shifts,
    // De-anonymise explanation text
    explanation:
      typeof response.explanation === "string"
        ? deAnonymiseText(response.explanation, mapping)
        : response.explanation,
    // De-anonymise warnings array
    warnings: Array.isArray(response.warnings)
      ? response.warnings.map((w: any) =>
          typeof w === "string" ? deAnonymiseText(w, mapping) : w,
        )
      : response.warnings,
    // De-anonymise insights array (if it exists)
    insights: Array.isArray(response.insights)
      ? response.insights.map((i: any) =>
          typeof i === "string" ? deAnonymiseText(i, mapping) : i,
        )
      : response.insights,
    // De-anonymise summary if it exists
    summary: response.summary
      ? {
          ...response.summary,
          employeeHours: Array.isArray(response.summary.employeeHours)
            ? response.summary.employeeHours.map((emp: any) => ({
                ...emp,
                name: mapping.get(emp.name) || emp.name,
              }))
            : response.summary.employeeHours,
        }
      : response.summary,
  };
}

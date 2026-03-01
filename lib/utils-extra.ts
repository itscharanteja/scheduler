import { format, parseISO, startOfWeek } from "date-fns";

export function formatDate(date: string | Date, pattern = "yyyy-MM-dd") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern);
}

export function getWeekStart(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return startOfWeek(d, { weekStartsOn: 1 });
}


import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export const WEEK_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Day-of-week label for a date within the week that starts on `weekMonday`. */
export function dayLabelInWeek(
  date: string,
  weekMonday: string,
): (typeof WEEK_DAY_LABELS)[number] | null {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(weekMonday));
  if (diff < 0 || diff > 6) return null;
  return WEEK_DAY_LABELS[diff];
}

export function weekDateRange(weekMonday: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekMonday), i), "yyyy-MM-dd"),
  );
}

export function dateInWeek(date: string, weekMonday: string): boolean {
  return dayLabelInWeek(date, weekMonday) != null;
}

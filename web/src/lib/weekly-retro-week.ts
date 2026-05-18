import { addDays, format, getDay, parseISO } from "date-fns";
import { weekStartMonday } from "@/lib/credits-bonus";

/** Monday of the calendar week that ended on the most recent Sunday (or today if Sunday). */
export function retrospectiveWeekStart(today: string): string {
  const parsed = parseISO(today);
  const dow = getDay(parsed);
  const lastSunday = format(addDays(parsed, -dow), "yyyy-MM-dd");
  return weekStartMonday(lastSunday);
}

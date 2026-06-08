import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Hour (in the user's local timezone) at which one "business day" ends and the
 * next begins. A business day runs from 04:00 to the following 04:00, so
 * late-night activity (00:00–03:59) is attributed to the previous date.
 */
export const DAY_BOUNDARY_HOUR = 4;

/**
 * Business-day date string (YYYY-MM-DD) in the user's IANA timezone, using the
 * 4 AM boundary. Times between midnight and 03:59 local map to the prior date.
 */
export function businessDayInTz(now: Date, timeZone: string): string {
  const zoned = toZonedTime(now, timeZone);
  zoned.setHours(zoned.getHours() - DAY_BOUNDARY_HOUR);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, "0");
  const d = String(zoned.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * UTC range [startUtc, endUtc) for the business day containing `now`, spanning
 * local 04:00:00.000 of the business day to local 04:00:00.000 of the next day.
 */
export function getBusinessDayRangeUtc(
  now: Date,
  timeZone: string,
): { startUtc: Date; endUtc: Date } {
  const zoned = toZonedTime(now, timeZone);
  // Shift back by the boundary hour so startOfDay lands on the business day.
  const shifted = new Date(zoned);
  shifted.setHours(shifted.getHours() - DAY_BOUNDARY_HOUR);
  const businessMidnight = startOfDay(shifted);
  // Local 04:00 of the business day.
  const startLocal = new Date(businessMidnight);
  startLocal.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0);
  const endLocal = addDays(startLocal, 1);
  return {
    startUtc: fromZonedTime(startLocal, timeZone),
    endUtc: fromZonedTime(endLocal, timeZone),
  };
}

/**
 * UTC instant of the business-day boundary (local 04:00) for the business day
 * that `now` falls in — i.e. the start of the current business day.
 */
export function businessDayStartUtc(now: Date, timeZone: string): Date {
  return getBusinessDayRangeUtc(now, timeZone).startUtc;
}

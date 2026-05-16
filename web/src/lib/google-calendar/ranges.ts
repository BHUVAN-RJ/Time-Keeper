import { addDays, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/** ISO bounds for Google Calendar API for a calendar week (Mon start). */
export function weekRangeUtc(
  weekStartMonday: string,
  timeZone: string,
): { timeMin: string; timeMax: string } {
  const startLocal = toZonedTime(parseISO(weekStartMonday), timeZone);
  const endLocal = addDays(startLocal, 7);
  const timeMin = fromZonedTime(startLocal, timeZone).toISOString();
  const timeMax = fromZonedTime(endLocal, timeZone).toISOString();
  return { timeMin, timeMax };
}

export function dayRangeUtc(
  date: string,
  timeZone: string,
): { timeMin: string; timeMax: string } {
  const startLocal = toZonedTime(parseISO(date), timeZone);
  const endLocal = addDays(startLocal, 1);
  const timeMin = fromZonedTime(startLocal, timeZone).toISOString();
  const timeMax = fromZonedTime(endLocal, timeZone).toISOString();
  return { timeMin, timeMax };
}

export function multiDayRangeUtc(
  startDate: string,
  endDateInclusive: string,
  timeZone: string,
): { timeMin: string; timeMax: string } {
  const startLocal = toZonedTime(parseISO(startDate), timeZone);
  const endLocal = addDays(toZonedTime(parseISO(endDateInclusive), timeZone), 1);
  return {
    timeMin: fromZonedTime(startLocal, timeZone).toISOString(),
    timeMax: fromZonedTime(endLocal, timeZone).toISOString(),
  };
}

/** Event overlaps a calendar date (YYYY-MM-DD) in user TZ. */
export function eventOnDate(
  ev: { start: string; end: string; allDay: boolean },
  date: string,
  timeZone: string,
): boolean {
  const { timeMin, timeMax } = dayRangeUtc(date, timeZone);
  const start = new Date(ev.start).getTime();
  const end = new Date(ev.end).getTime();
  const min = new Date(timeMin).getTime();
  const max = new Date(timeMax).getTime();
  return start < max && end > min;
}

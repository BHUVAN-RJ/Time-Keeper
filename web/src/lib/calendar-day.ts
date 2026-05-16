/** Calendar date string (YYYY-MM-DD) in the user's IANA timezone. */
export function calendarDayInTz(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

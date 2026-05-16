import { eventOnDate } from "@/lib/google-calendar/ranges";
import type { CalendarEventView } from "@/lib/google-calendar/types";

export function formatEventWhen(
  ev: CalendarEventView,
  timeZone: string,
): string {
  if (ev.allDay) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(ev.start));
  }
  const start = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ev.start));
  const end = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ev.end));
  return `${start} – ${end}`;
}

export function groupEventsByDate(
  events: CalendarEventView[],
  dates: string[],
  timeZone: string,
): { date: string; events: CalendarEventView[] }[] {
  return dates.map((date) => ({
    date,
    events: events.filter((ev) => eventOnDate(ev, date, timeZone)),
  }));
}

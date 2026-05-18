import type { reminders } from "@/db/schema";
import { calendarDayInTz } from "@/lib/calendar-day";
import { addDays, addMonths, addWeeks, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type ReminderRow = typeof reminders.$inferSelect;
export type RecurringKind = "daily" | "weekly" | "monthly";

/** When a reminder becomes eligible to fire (after snooze). */
export function effectiveRemindAt(row: ReminderRow): Date {
  const base = new Date(row.remindAt);
  if (row.snoozedUntil && row.snoozedUntil > base) {
    return new Date(row.snoozedUntil);
  }
  return base;
}

export function isReminderDue(row: ReminderRow, now = new Date()): boolean {
  if (row.acknowledged) return false;
  return now.getTime() >= effectiveRemindAt(row).getTime();
}

export function formatReminderWhen(at: Date, timeZone: string): string {
  const today = calendarDayInTz(new Date(), timeZone);
  const day = calendarDayInTz(at, timeZone);
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
  if (day === today) return `Today ${time}`;
  const tomorrow = calendarDayInTz(addDays(parseISO(today), 1), timeZone);
  if (day === tomorrow) return `Tomorrow ${time}`;
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(at);
  return `${date} ${time}`;
}

export function nextRecurringRemindAt(
  from: Date,
  recurring: RecurringKind,
  _recurringDayOfWeek: number | null,
  timeZone: string,
): Date {
  const zoned = toZonedTime(from, timeZone);
  if (recurring === "daily") {
    return fromZonedTime(addDays(zoned, 1), timeZone);
  }
  if (recurring === "weekly") {
    return fromZonedTime(addWeeks(zoned, 1), timeZone);
  }
  return fromZonedTime(addMonths(zoned, 1), timeZone);
}

/** Parse `datetime-local` value (YYYY-MM-DDTHH:mm) in user TZ. */
export function parseRemindAtLocal(value: string, timeZone: string): Date {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error("Invalid date and time");
  }
  const [datePart, timePart] = trimmed.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  return fromZonedTime(local, timeZone);
}

export function formatRemindAtLocal(at: Date, timeZone: string): string {
  const zoned = toZonedTime(at, timeZone);
  const y = zoned.getFullYear();
  const mo = String(zoned.getMonth() + 1).padStart(2, "0");
  const d = String(zoned.getDate()).padStart(2, "0");
  const h = String(zoned.getHours()).padStart(2, "0");
  const mi = String(zoned.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function defaultRemindAtLocal(timeZone: string): string {
  const zoned = toZonedTime(new Date(), timeZone);
  zoned.setMinutes(zoned.getMinutes() + 30 - (zoned.getMinutes() % 15), 0, 0);
  return formatRemindAtLocal(fromZonedTime(zoned, timeZone), timeZone);
}

export function snoozeUntil(
  kind: "10m" | "1h" | "tomorrow",
  timeZone: string,
  now = new Date(),
): Date {
  if (kind === "10m") return new Date(now.getTime() + 10 * 60 * 1000);
  if (kind === "1h") return new Date(now.getTime() + 60 * 60 * 1000);
  const zoned = toZonedTime(now, timeZone);
  const next = addDays(zoned, 1);
  next.setHours(9, 0, 0, 0);
  return fromZonedTime(next, timeZone);
}

export function remindersDueToday(
  rows: ReminderRow[],
  today: string,
  timeZone: string,
): ReminderRow[] {
  return rows
    .filter((r) => {
      if (r.acknowledged) return false;
      const eff = effectiveRemindAt(r);
      const day = calendarDayInTz(eff, timeZone);
      return day === today || day < today;
    })
    .sort(
      (a, b) =>
        effectiveRemindAt(a).getTime() - effectiveRemindAt(b).getTime(),
    );
}

export function sortDueReminders(rows: ReminderRow[]): ReminderRow[] {
  return [...rows]
    .filter((r) => isReminderDue(r))
    .sort(
      (a, b) =>
        effectiveRemindAt(a).getTime() - effectiveRemindAt(b).getTime(),
    );
}

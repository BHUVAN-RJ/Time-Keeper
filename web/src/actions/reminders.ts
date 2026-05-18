"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import {
  defaultRemindAtLocal,
  effectiveRemindAt,
  formatRemindAtLocal,
  formatReminderWhen,
  isReminderDue,
  nextRecurringRemindAt,
  parseRemindAtLocal,
  remindersDueToday,
  snoozeUntil,
  sortDueReminders,
  type RecurringKind,
} from "@/lib/reminders";
import { toZonedTime } from "date-fns-tz";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

function revalidateReminderPaths() {
  revalidatePath("/reminders");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/stats");
  revalidatePath("/settings");
}

export type ReminderView = {
  id: string;
  title: string;
  remindAt: string;
  remindAtLocal: string;
  remindAtLabel: string;
  recurring: RecurringKind | null;
  recurringDayOfWeek: number | null;
  linkedTaskId: string | null;
  acknowledged: boolean;
  due: boolean;
  snoozedLabel: string | null;
};

function toView(
  row: typeof reminders.$inferSelect,
  timezone: string,
  now = new Date(),
): ReminderView {
  const at = effectiveRemindAt(row);
  const scheduled = new Date(row.remindAt);
  const snoozed =
    row.snoozedUntil && row.snoozedUntil > scheduled
      ? formatReminderWhen(new Date(row.snoozedUntil), timezone)
      : null;
  return {
    id: row.id,
    title: row.title,
    remindAt: at.toISOString(),
    remindAtLocal: formatRemindAtLocal(scheduled, timezone),
    remindAtLabel: formatReminderWhen(at, timezone),
    recurring: row.recurring,
    recurringDayOfWeek: row.recurringDayOfWeek,
    linkedTaskId: row.linkedTaskId,
    acknowledged: row.acknowledged,
    due: isReminderDue(row, now),
    snoozedLabel: snoozed,
  };
}

async function listRows(userId: string) {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(desc(reminders.remindAt));
}

export async function getRemindersPageData() {
  const { userId, timezone } = await requireUser();
  const now = new Date();
  const rows = await listRows(userId);
  const upcoming = rows
    .filter((r) => !r.acknowledged)
    .map((r) => toView(r, timezone, now))
    .sort(
      (a, b) =>
        new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
    );
  const past = rows
    .filter((r) => r.acknowledged)
    .map((r) => toView(r, timezone, now))
    .slice(0, 20);

  return {
    timezone,
    defaultRemindAtLocal: defaultRemindAtLocal(timezone),
    upcoming,
    past,
    dueCount: sortDueReminders(rows).length,
  };
}

export async function getReminderChromeData() {
  const { userId, timezone } = await requireUser();
  const now = new Date();
  const rows = await listRows(userId);
  const due = sortDueReminders(rows).map((r) => toView(r, timezone, now));
  return {
    dueCount: due.length,
    banner: due[0] ?? null,
  };
}

export type ReminderChromeData = Awaited<ReturnType<typeof getReminderChromeData>>;

export type PollReminderChromeResult =
  | { ok: true; data: ReminderChromeData }
  | { ok: false; unauthorized: true };

/** Client polling — never throws on auth loss. */
export async function pollReminderChromeData(): Promise<PollReminderChromeResult> {
  try {
    const data = await getReminderChromeData();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, unauthorized: true };
    }
    throw e;
  }
}

export async function getRemindersForAmRundown(userId: string, timezone: string) {
  const today = calendarDayInTz(new Date(), timezone);
  const rows = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.acknowledged, false)));
  return remindersDueToday(rows, today, timezone).map((r) => ({
    id: r.id,
    title: r.title,
    when: formatReminderWhen(effectiveRemindAt(r), timezone),
  }));
}

export async function createReminderAction(input: {
  title: string;
  remindAtLocal: string;
  recurring?: RecurringKind | null;
  recurringDayOfWeek?: number | null;
  linkedTaskId?: string | null;
}) {
  const { userId, timezone } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const remindAt = parseRemindAtLocal(input.remindAtLocal, timezone);
  const recurring = input.recurring ?? null;
  if (!recurring && remindAt.getTime() < Date.now() - 60_000) {
    throw new Error("Remind time must be in the future");
  }
  let recurringDayOfWeek = input.recurringDayOfWeek ?? null;
  if (recurring === "weekly" && recurringDayOfWeek == null) {
    recurringDayOfWeek = toZonedWeekday(remindAt, timezone);
  }

  await db.insert(reminders).values({
    userId,
    title,
    remindAt,
    recurring,
    recurringDayOfWeek,
    linkedTaskId: input.linkedTaskId?.trim() || null,
  });

  revalidateReminderPaths();
}

export async function updateReminderAction(input: {
  id: string;
  title: string;
  remindAtLocal: string;
  recurring?: RecurringKind | null;
}) {
  const { userId, timezone } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const [row] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, input.id), eq(reminders.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Reminder not found");

  const remindAt = parseRemindAtLocal(input.remindAtLocal, timezone);
  const recurring = input.recurring ?? null;
  if (!recurring && remindAt.getTime() < Date.now() - 60_000) {
    throw new Error("Remind time must be in the future");
  }

  let recurringDayOfWeek = row.recurringDayOfWeek;
  if (recurring === "weekly") {
    recurringDayOfWeek = toZonedWeekday(remindAt, timezone);
  } else if (!recurring) {
    recurringDayOfWeek = null;
  }

  await db
    .update(reminders)
    .set({
      title,
      remindAt,
      recurring,
      recurringDayOfWeek,
      acknowledged: false,
      acknowledgedAt: null,
      snoozedUntil: null,
    })
    .where(and(eq(reminders.id, input.id), eq(reminders.userId, userId)));

  revalidateReminderPaths();
}

export async function deleteReminderAction(id: string) {
  const { userId } = await requireUser();
  await db
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  revalidateReminderPaths();
}

export async function acknowledgeReminderAction(id: string) {
  const { userId, timezone } = await requireUser();
  const [row] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Reminder not found");

  const now = new Date();
  if (row.recurring) {
    const nextAt = nextRecurringRemindAt(
      effectiveRemindAt(row),
      row.recurring,
      row.recurringDayOfWeek,
      timezone,
    );
    await db
      .update(reminders)
      .set({
        remindAt: nextAt,
        acknowledged: false,
        acknowledgedAt: null,
        snoozedUntil: null,
      })
      .where(eq(reminders.id, id));
  } else {
    await db
      .update(reminders)
      .set({
        acknowledged: true,
        acknowledgedAt: now,
        snoozedUntil: null,
      })
      .where(eq(reminders.id, id));
  }

  revalidateReminderPaths();
}

export async function snoozeReminderAction(
  id: string,
  kind: "10m" | "1h" | "tomorrow",
) {
  const { userId, timezone } = await requireUser();
  const until = snoozeUntil(kind, timezone);

  await db
    .update(reminders)
    .set({ snoozedUntil: until })
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));

  revalidateReminderPaths();
}

function toZonedWeekday(at: Date, timeZone: string): number {
  return toZonedTime(at, timeZone).getDay();
}

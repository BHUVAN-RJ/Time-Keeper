"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { dailyReviews, dayStatus } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import {
  computeDaySnapshot,
  rollingProductivityAvg,
} from "@/lib/day-compute";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { fetchCalendarEventsForRange } from "@/lib/google-calendar/service";
import { eventOnDate, multiDayRangeUtc } from "@/lib/google-calendar/ranges";
import { addDays, format, parseISO } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export async function getAmRundownData() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const yesterday = format(addDays(parseISO(today), -1), "yyyy-MM-dd");

  const [review] = await db
    .select()
    .from(dailyReviews)
    .where(and(eq(dailyReviews.userId, userId), eq(dailyReviews.date, today)))
    .limit(1);

  const show = !review?.amSeenAt;

  const rollingAvg = await rollingProductivityAvg(userId, timezone, today);

  const ySnap = await computeDaySnapshot(userId, yesterday, timezone);
  const yesterdayScore =
    ySnap.hasActivity || ySnap.endedAt ? ySnap.productivityScore : null;

  const [yStatus] = await db
    .select()
    .from(dayStatus)
    .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, yesterday)))
    .limit(1);

  const yesterdayHabitsLine =
    yStatus?.habitsCompletionPercent != null
      ? `habits ${Math.round(yStatus.habitsCompletionPercent)}%`
      : null;

  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  const range = multiDayRangeUtc(today, tomorrow, timezone);
  const cal = await fetchCalendarEventsForRange(
    userId,
    today,
    tomorrow,
    range.timeMin,
    range.timeMax,
  );
  const calendarToday = cal.events
    .filter((ev) => eventOnDate(ev, today, timezone))
    .slice(0, 6);
  const calendarTomorrow = cal.events
    .filter((ev) => eventOnDate(ev, tomorrow, timezone))
    .slice(0, 4);

  return {
    show,
    rollingAvg,
    yesterdayScore,
    yesterdayHabitsLine,
    calendarToday,
    calendarTomorrow,
    calendarMeta: cal.meta,
  };
}

export async function dismissAmRundownAction() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const now = new Date();

  await db
    .insert(dailyReviews)
    .values({
      userId,
      date: today,
      amSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [dailyReviews.userId, dailyReviews.date],
      set: { amSeenAt: now },
    });

  revalidatePath("/today");
}

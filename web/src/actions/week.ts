"use server";

import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { computeWeekSnapshots } from "@/lib/day-compute";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { fetchCalendarEventsForRange } from "@/lib/google-calendar/service";
import { weekRangeUtc } from "@/lib/google-calendar/ranges";
import type { CalendarEventsResult } from "@/lib/google-calendar/types";
import { and, eq, inArray, or } from "drizzle-orm";
import { addDays, format, parseISO, startOfWeek } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

const ACTIVE = ["backlog", "scheduled", "in_progress"] as const;

export type NextWeekTaskRow = {
  id: string;
  title: string;
  estimateMinutes: number;
  dueDate: string | null;
  scheduledDate: string | null;
};

export async function getWeekData(weekStart?: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const anchor = weekStart ?? today;
  const monday = format(
    startOfWeek(parseISO(anchor), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const thisSunday = format(addDays(parseISO(monday), 6), "yyyy-MM-dd");
  const nextMonday = format(addDays(parseISO(monday), 7), "yyyy-MM-dd");
  const nextSunday = format(addDays(parseISO(nextMonday), 6), "yyyy-MM-dd");

  const getCachedWeek = unstable_cache(
    async () => computeWeekSnapshots(userId, monday, timezone),
    ["week-snapshots", userId, monday, timezone],
    { revalidate: 86400, tags: [`week-${userId}`] },
  );
  const days = await getCachedWeek();

  const endedDays = days.filter((d) => d.endedAt);
  const avgScore =
    endedDays.length > 0
      ? Math.round(
          endedDays.reduce((s, d) => s + d.productivityScore, 0) /
            endedDays.length,
        )
      : null;

  const nextWeekDates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(nextMonday), i), "yyyy-MM-dd"),
  );

  const taskRows = await db
    .select({ task: tasks })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, [...ACTIVE]),
        or(
          inArray(tasks.scheduledDate, nextWeekDates),
          inArray(tasks.dueDate, nextWeekDates),
        ),
      ),
    );

  const nextWeekTasks: NextWeekTaskRow[] = taskRows
    .map((r) => r.task)
    .map((t) => ({
      id: t.id,
      title: t.title,
      estimateMinutes: t.estimateMinutes,
      dueDate: t.dueDate,
      scheduledDate: t.scheduledDate,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const plannedMinutes = nextWeekTasks.reduce(
    (s, t) => s + t.estimateMinutes,
    0,
  );

  let calendarThisWeek: CalendarEventsResult = {
    events: [],
    meta: {
      configured: false,
      connected: false,
      stale: false,
      error: null,
      fetchedAt: null,
      accountCount: 0,
    },
  };
  let calendarNextWeek: CalendarEventsResult = calendarThisWeek;

  const thisUtc = weekRangeUtc(monday, timezone);
  calendarThisWeek = await fetchCalendarEventsForRange(
    userId,
    monday,
    thisSunday,
    thisUtc.timeMin,
    thisUtc.timeMax,
  );

  const nextUtc = weekRangeUtc(nextMonday, timezone);
  calendarNextWeek = await fetchCalendarEventsForRange(
    userId,
    nextMonday,
    nextSunday,
    nextUtc.timeMin,
    nextUtc.timeMax,
  );

  return {
    timezone,
    today,
    weekStart: monday,
    nextWeekStart: nextMonday,
    days,
    avgScore,
    nextWeekTasks,
    plannedMinutes,
    calendarThisWeek,
    calendarNextWeek,
  };
}

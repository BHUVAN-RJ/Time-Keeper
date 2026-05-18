"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, dailyReviews, dayStatus, tasks } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTodayHabits } from "@/actions/habits";
import { calendarDayInTz } from "@/lib/calendar-day";
import {
  computeDaySnapshot,
  rollingProductivityAvg,
} from "@/lib/day-compute";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { habitsRecapForDate } from "@/lib/habits-compute";
import { compareTasksForToday } from "@/lib/task-utils";
import { eventOnDate } from "@/lib/google-calendar/ranges";
import { getTodayCalendarEvents } from "@/lib/today-calendar-cache";
import type {
  CalendarEventView,
  CalendarFetchMeta,
} from "@/lib/google-calendar/types";
import { formatCredits } from "@/lib/credits";
import { listUnclosedDaysBeforeToday } from "@/lib/unclosed-days";
import { addDays, format, parseISO } from "date-fns";
import {
  getEndDayPreview,
  submitEndDayAction,
  type IncompleteResolution,
} from "@/actions/end-day";
import { getRemindersForAmRundown } from "@/actions/reminders";

const ACTIVE = ["backlog", "scheduled", "in_progress"] as const;

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

function parseTomorrowsPlan(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, 3);
  } catch {
    return [];
  }
}

const EMPTY_CALENDAR_META: CalendarFetchMeta = {
  configured: false,
  connected: false,
  stale: false,
  error: null,
  fetchedAt: null,
  accountCount: 0,
};

function hiddenAmRundown(today: string, yesterday: string) {
  return {
    mode: "hidden" as const,
    today,
    yesterday,
    unclosedDays: [] as string[],
    closeTarget: yesterday,
    rollingAvg: null as number | null,
    yesterdayScore: null as number | null,
    yesterdayCredits: null as string | null,
    yesterdayHabits: [] as Awaited<ReturnType<typeof habitsRecapForDate>>,
    pinnedTop3: [] as { id: string; title: string }[],
    scheduledToday: [] as {
      id: string;
      title: string;
      scheduledDate: string | null;
      dueDate: string | null;
    }[],
    dueToday: [] as {
      id: string;
      title: string;
      scheduledDate: string | null;
      dueDate: string | null;
    }[],
    todayHabits: [] as Awaited<ReturnType<typeof getTodayHabits>>["habits"],
    todayIsOffDay: false,
    calendarToday: [] as CalendarEventView[],
    calendarTomorrow: [] as CalendarEventView[],
    calendarMeta: EMPTY_CALENDAR_META,
    remindersToday: [] as Awaited<ReturnType<typeof getRemindersForAmRundown>>,
  };
}

export async function getAmRundownData() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const yesterday = format(addDays(parseISO(today), -1), "yyyy-MM-dd");

  const [unclosedDays, todayReview] = await Promise.all([
    listUnclosedDaysBeforeToday(userId, timezone, today),
    db
      .select({ amSeenAt: dailyReviews.amSeenAt })
      .from(dailyReviews)
      .where(and(eq(dailyReviews.userId, userId), eq(dailyReviews.date, today)))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const closeTarget = unclosedDays[0] ?? yesterday;
  const hasUnclosed = unclosedDays.length > 0;
  const mode: "unclosed" | "rundown" | "hidden" = hasUnclosed
    ? "unclosed"
    : !todayReview?.amSeenAt
      ? "rundown"
      : "hidden";

  if (mode === "hidden") {
    return hiddenAmRundown(today, yesterday);
  }

  const [yStatus, yReview] = await Promise.all([
    db
      .select()
      .from(dayStatus)
      .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, yesterday)))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(dailyReviews)
      .where(and(eq(dailyReviews.userId, userId), eq(dailyReviews.date, yesterday)))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const yesterdayClosed = !!yStatus?.endedAt;

  const rollingAvg = await rollingProductivityAvg(userId, timezone, today);

  const ySnap = await computeDaySnapshot(userId, yesterday, timezone);
  const yesterdayScore =
    ySnap.hasActivity || ySnap.endedAt ? ySnap.productivityScore : null;
  const yesterdayCredits =
    yStatus?.endedAt != null ? ySnap.creditsEarned : null;

  const yesterdayHabits = yesterdayClosed
    ? await habitsRecapForDate(userId, yesterday)
    : [];

  const pinnedIds = parseTomorrowsPlan(yReview?.tomorrowsPlanJson ?? null);
  let pinnedTop3: { id: string; title: string }[] = [];
  if (pinnedIds.length > 0) {
    const pinnedRows = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(eq(tasks.userId, userId), inArray(tasks.id, pinnedIds)),
      );
    const byId = new Map(pinnedRows.map((t) => [t.id, t]));
    pinnedTop3 = pinnedIds
      .map((id) => byId.get(id))
      .filter((t): t is { id: string; title: string } => !!t);
  }

  const taskRows = await db
    .select({
      task: tasks,
      categoryName: categories.name,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, [...ACTIVE]),
        or(
          eq(tasks.scheduledDate, today),
          eq(tasks.dueDate, today),
          eq(tasks.status, "in_progress"),
        ),
      ),
    );

  const todayTasks = taskRows
    .map((r) => r.task)
    .sort((a, b) => compareTasksForToday(a, b))
    .map((t) => ({
      id: t.id,
      title: t.title,
      scheduledDate: t.scheduledDate,
      dueDate: t.dueDate,
    }));

  const scheduledToday = todayTasks.filter(
    (t) => t.scheduledDate === today,
  );
  const dueToday = todayTasks.filter(
    (t) => t.dueDate === today && t.scheduledDate !== today,
  );

  const { habits: todayHabits, todayIsOffDay } = await getTodayHabits();

  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  const cal = await getTodayCalendarEvents(userId, today, tomorrow, timezone);
  const calendarToday = cal.events
    .filter((ev) => eventOnDate(ev, today, timezone))
    .slice(0, 6);
  const calendarTomorrow = cal.events
    .filter((ev) => eventOnDate(ev, tomorrow, timezone))
    .slice(0, 4);

  const remindersToday = await getRemindersForAmRundown(userId, timezone);

  return {
    mode,
    today,
    yesterday,
    unclosedDays,
    closeTarget,
    rollingAvg,
    yesterdayScore,
    yesterdayCredits:
      yesterdayCredits != null ? formatCredits(yesterdayCredits) : null,
    yesterdayHabits,
    pinnedTop3,
    scheduledToday,
    dueToday,
    todayHabits,
    todayIsOffDay,
    calendarToday,
    calendarTomorrow,
    calendarMeta: cal.meta,
    remindersToday,
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

/** Close every unclosed day (oldest first) with defaults: incomplete → tomorrow. */
export async function batchCloseUnclosedDaysAction() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const days = await listUnclosedDaysBeforeToday(userId, timezone, today);
  if (days.length === 0) {
    return { ok: true as const, closed: 0 };
  }

  for (const closeDay of days) {
    const preview = await getEndDayPreview(closeDay);
    if (preview.alreadyEnded) continue;

    const resolutions: IncompleteResolution[] = preview.incomplete.map(
      (t) => ({ taskId: t.id, action: "tomorrow" as const }),
    );

    await submitEndDayAction({
      closeDate: closeDay,
      tomorrowsTop3: [],
      incompleteResolutions: resolutions,
    });
  }

  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/stats");

  return { ok: true as const, closed: days.length };
}

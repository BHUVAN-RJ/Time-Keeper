"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, dailyReviews, dayStatus, tasks } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { getTodayHabits } from "@/actions/habits";
import { compareTasksForToday, type TaskLike } from "@/lib/task-utils";
import { eventOnDate } from "@/lib/google-calendar/ranges";
import { getTodayCalendarEvents } from "@/lib/today-calendar-cache";
import { getWeeklyCommitmentsForToday } from "@/actions/weekly-review";
import { getStaleProjects } from "@/actions/projects";
import {
  adjustedEstimateMinutes,
  estimateAccuracyMultiplier,
} from "@/lib/estimate-accuracy";
import { getOffDayBalance, OFF_DAY_NUDGE_AT } from "@/lib/off-day-balance";
import { computeDaySnapshot } from "@/lib/day-compute";
import { addDays, format, parseISO } from "date-fns";

const ACTIVE = ["backlog", "scheduled", "in_progress"] as const;

export type TodayTaskRow = typeof tasks.$inferSelect & {
  categoryName: string | null;
  categoryColor: string | null;
};

export async function getTodayDashboardExtras() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  const today = calendarDayInTz(new Date(), timezone);
  const yesterday = format(addDays(parseISO(today), -1), "yyyy-MM-dd");

  const [
    statusRow,
    habitsToday,
    yReview,
    offDayBank,
    staleProjects,
    weeklyCommitments,
    estimateHint,
    daySnap,
  ] = await Promise.all([
    db
      .select()
      .from(dayStatus)
      .where(and(eq(dayStatus.userId, id), eq(dayStatus.date, today)))
      .limit(1)
      .then((rows) => rows[0]),
    getTodayHabits(),
    db
      .select({ tomorrowsPlanJson: dailyReviews.tomorrowsPlanJson })
      .from(dailyReviews)
      .where(
        and(eq(dailyReviews.userId, id), eq(dailyReviews.date, yesterday)),
      )
      .limit(1)
      .then((r) => r[0]),
    getOffDayBalance(id),
    getStaleProjects(),
    getWeeklyCommitmentsForToday(),
    estimateAccuracyMultiplier(id),
    computeDaySnapshot(id, today, timezone),
  ]);

  let pinnedTop3: { id: string; title: string }[] = [];
  if (yReview?.tomorrowsPlanJson) {
    try {
      const ids = (JSON.parse(yReview.tomorrowsPlanJson) as unknown[]).filter(
        (x): x is string => typeof x === "string",
      );
      if (ids.length > 0) {
        const rows = await db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(and(eq(tasks.userId, id), inArray(tasks.id, ids.slice(0, 3))));
        const byId = new Map(rows.map((t) => [t.id, t]));
        pinnedTop3 = ids
          .slice(0, 3)
          .map((tid) => byId.get(tid))
          .filter((t): t is { id: string; title: string } => !!t);
      }
    } catch {
      pinnedTop3 = [];
    }
  }

  const rows = await db
    .select({
      task: tasks,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(
      and(
        eq(tasks.userId, id),
        inArray(tasks.status, [...ACTIVE]),
        or(
          eq(tasks.scheduledDate, today),
          eq(tasks.dueDate, today),
          eq(tasks.status, "in_progress"),
        ),
      ),
    );

  const todayTasks: TodayTaskRow[] = rows
    .map((r) => ({
      ...r.task,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
    }))
    .sort((a, b) => compareTasksForToday(a as TaskLike, b as TaskLike));

  const whatsNext = todayTasks[0] ?? null;

  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  const calendarRange = await getTodayCalendarEvents(
    id,
    today,
    tomorrow,
    timezone,
  );
  const calendarToday = calendarRange.events.filter((ev) =>
    eventOnDate(ev, today, timezone),
  );

  const scheduledMinutes = todayTasks.reduce(
    (s, t) => s + t.estimateMinutes,
    0,
  );
  const adjustedScheduled = estimateHint.ready
    ? adjustedEstimateMinutes(scheduledMinutes, estimateHint.multiplier)
    : scheduledMinutes;
  const capacityThreshold = daySnap.workGoalMinutes * 0.8;
  const capacityWarning =
    daySnap.workGoalMinutes > 0 &&
    adjustedScheduled > capacityThreshold;

  return {
    timezone,
    today,
    todayTasks,
    whatsNext,
    habits: habitsToday.habits,
    pinnedTop3,
    weeklyCommitments,
    dayEnded: !!statusRow?.endedAt,
    isOffDay: !!statusRow?.isOffDay,
    isVacation: !!statusRow?.isVacation,
    offDaysAvailable: offDayBank.available,
    offDayForfeited: offDayBank.lifetimeForfeited,
    showOffDayRestNudge: offDayBank.available >= OFF_DAY_NUDGE_AT,
    staleProjects: staleProjects.map((s) => ({
      id: s.project.id,
      name: s.project.name,
      daysSince: s.daysSince,
    })),
    capacityWarning,
    capacityScheduledMinutes: adjustedScheduled,
    capacityGoalMinutes: daySnap.workGoalMinutes,
    estimateHint: estimateHint.ready
      ? {
          multiplier: estimateHint.multiplier,
          completedCount: estimateHint.completedCount,
        }
      : null,
    calendarToday,
    calendarMeta: calendarRange.meta,
  };
}

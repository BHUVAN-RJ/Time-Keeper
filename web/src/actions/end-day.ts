"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { dailyReviews, dayStatus, tasks } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import {
  computeDaySnapshot,
  dayCreditMultiplier,
  rollingProductivityAvg,
} from "@/lib/day-compute";
import {
  applyAutoFreezesForDate,
  habitsRecapForDate,
} from "@/lib/habits-compute";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { weeklyCreditBonusMinutes, weekStartMonday } from "@/lib/credits-bonus";
import { accrueOffDaysOnEndDay } from "@/lib/off-day-balance";
import { persistProductivityScore } from "@/lib/productivity-scores";
import { getWeeklyReviewNudgeForEndDay } from "@/actions/weekly-review";
import {
  applyOverworkForDay,
  formatOverworkMinutes,
  getOverworkCreditsPercent,
  overworkMinutes,
  projectOverworkSplit,
} from "@/lib/overwork";
import { addDays, format, getDay, parseISO } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

/** Close a specific calendar day (today or catch-up for yesterday). */
export async function getEndDayPreview(closeDate?: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const closeDay = closeDate ?? today;
  const snap = await computeDaySnapshot(userId, closeDay, timezone);
  const rollingAvg = await rollingProductivityAvg(
    userId,
    timezone,
    closeDay,
  );
  const habits = await habitsRecapForDate(userId, closeDay);

  const incomplete = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ["scheduled", "in_progress"]),
        or(
          eq(tasks.scheduledDate, closeDay),
          eq(tasks.dueDate, closeDay),
        ),
      ),
    );

  const allTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ["backlog", "scheduled", "in_progress"]),
      ),
    );

  const nextDay = format(addDays(parseISO(closeDay), 1), "yyyy-MM-dd");

  const owMins = overworkMinutes(snap.workMinutes, snap.workGoalMinutes);
  const creditsPercent = await getOverworkCreditsPercent(userId);
  const owSplit = projectOverworkSplit(owMins, creditsPercent);

  return {
    closeDay,
    isCatchUp: closeDay !== today,
    nextDay,
    snapshot: snap,
    rollingAvg,
    habits,
    scoreVsAvg:
      rollingAvg != null ? snap.productivityScore - rollingAvg : null,
    incomplete,
    pickableTasks: allTasks,
    alreadyEnded: !!snap.endedAt,
    overwork: {
      minutes: owMins,
      creditsPercent,
      projectedCreditBonus: owSplit.toCredits,
      projectedBankMinutes: owSplit.toBank,
      label: formatOverworkMinutes(owMins),
    },
  };
}

export type IncompleteResolution =
  | { taskId: string; action: "tomorrow" }
  | { taskId: string; action: "date"; date: string }
  | { taskId: string; action: "drop"; reason: string };

export async function submitEndDayAction(input: {
  closeDate?: string;
  mood?: number | null;
  notes?: string | null;
  tomorrowsTop3: string[];
  incompleteResolutions: IncompleteResolution[];
}) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const closeDay = input.closeDate ?? today;
  const nextDay = format(addDays(parseISO(closeDay), 1), "yyyy-MM-dd");

  await applyAutoFreezesForDate(userId, closeDay, timezone);
  const snap = await computeDaySnapshot(userId, closeDay, timezone);
  const mult = dayCreditMultiplier(snap.goalHitPercent);
  const rollingAvg = await rollingProductivityAvg(userId, timezone, closeDay);
  const scoreVsAvg =
    rollingAvg != null ? snap.productivityScore - rollingAvg : 0;

  for (const res of input.incompleteResolutions) {
    if (res.action === "tomorrow") {
      const [t] = await db
        .select({ n: tasks.rescheduleCount })
        .from(tasks)
        .where(eq(tasks.id, res.taskId))
        .limit(1);
      await db
        .update(tasks)
        .set({
          scheduledDate: nextDay,
          status: "scheduled",
          rescheduleCount: (t?.n ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, res.taskId), eq(tasks.userId, userId)));
    } else if (res.action === "date") {
      const [t] = await db
        .select({ n: tasks.rescheduleCount })
        .from(tasks)
        .where(eq(tasks.id, res.taskId))
        .limit(1);
      await db
        .update(tasks)
        .set({
          scheduledDate: res.date,
          status: "scheduled",
          rescheduleCount: (t?.n ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, res.taskId), eq(tasks.userId, userId)));
    } else if (res.action === "drop") {
      const reason = res.reason.trim();
      if (!reason) throw new Error("Drop reason is required");
      await db
        .update(tasks)
        .set({
          status: "dropped",
          droppedAt: new Date(),
          dropReason: reason,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, res.taskId), eq(tasks.userId, userId)));
    }
  }

  let weeklyBonus = 0;
  const dow = getDay(parseISO(closeDay));
  if (dow === 0) {
    weeklyBonus = await weeklyCreditBonusMinutes(
      userId,
      weekStartMonday(closeDay),
    );
  }

  const overwork = await applyOverworkForDay(
    userId,
    snap.workMinutes,
    snap.workGoalMinutes,
  );

  const creditsEarned =
    snap.creditsEarned * mult + weeklyBonus + overwork.creditBonus;

  const now = new Date();
  await db
    .insert(dayStatus)
    .values({
      userId,
      date: closeDay,
      goalHitPercent: snap.goalHitPercent,
      isRed: snap.isRed,
      habitsCompletionPercent: snap.scoreBreakdown.habitsPercent,
      creditsEarned,
      creditsSpent: snap.creditsSpent,
      creditsOverworkBonus: overwork.creditBonus,
      creditsWeeklyBonus: weeklyBonus,
      productivityScore: snap.productivityScore,
      scoreVsAvgDelta: scoreVsAvg,
      endedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dayStatus.userId, dayStatus.date],
      set: {
        goalHitPercent: snap.goalHitPercent,
        isRed: snap.isRed,
        habitsCompletionPercent: snap.scoreBreakdown.habitsPercent,
        creditsEarned,
        creditsSpent: snap.creditsSpent,
        creditsOverworkBonus: overwork.creditBonus,
        creditsWeeklyBonus: weeklyBonus,
        productivityScore: snap.productivityScore,
        scoreVsAvgDelta: scoreVsAvg,
        endedAt: now,
        updatedAt: now,
      },
    });

  await persistProductivityScore(userId, snap, rollingAvg);
  await accrueOffDaysOnEndDay(userId, closeDay);

  await db
    .insert(dailyReviews)
    .values({
      userId,
      date: closeDay,
      pmCompletedAt: now,
      mood: input.mood ?? null,
      notes: input.notes?.trim() || null,
      tomorrowsPlanJson: JSON.stringify(input.tomorrowsTop3.slice(0, 3)),
    })
    .onConflictDoUpdate({
      target: [dailyReviews.userId, dailyReviews.date],
      set: {
        pmCompletedAt: now,
        mood: input.mood ?? null,
        notes: input.notes?.trim() || null,
        tomorrowsPlanJson: JSON.stringify(input.tomorrowsTop3.slice(0, 3)),
      },
    });

  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/stats");

  const weeklyReviewNudge = await getWeeklyReviewNudgeForEndDay(closeDay);
  return {
    ok: true as const,
    weeklyBonusMinutes: weeklyBonus,
    overworkBonus: overwork.creditBonus,
    overworkMinutes: overwork.overworkMinutes,
    weeklyReviewNudge: weeklyReviewNudge.show,
  };
}

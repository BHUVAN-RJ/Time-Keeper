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
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { addDays, format, parseISO } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export async function getEndDayPreview() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const snap = await computeDaySnapshot(userId, today, timezone);
  const rollingAvg = await rollingProductivityAvg(userId, timezone, today);

  const incomplete = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ["scheduled", "in_progress"]),
        or(eq(tasks.scheduledDate, today), eq(tasks.dueDate, today)),
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

  return {
    today,
    snapshot: snap,
    rollingAvg,
    scoreVsAvg:
      rollingAvg != null ? snap.productivityScore - rollingAvg : null,
    incomplete,
    pickableTasks: allTasks,
    alreadyEnded: !!snap.endedAt,
  };
}

export type IncompleteResolution =
  | { taskId: string; action: "tomorrow" }
  | { taskId: string; action: "date"; date: string }
  | { taskId: string; action: "drop"; reason: string };

export async function submitEndDayAction(input: {
  mood?: number | null;
  notes?: string | null;
  tomorrowsTop3: string[];
  incompleteResolutions: IncompleteResolution[];
}) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  const snap = await computeDaySnapshot(userId, today, timezone);
  const mult = dayCreditMultiplier(snap.goalHitPercent);
  const rollingAvg = await rollingProductivityAvg(userId, timezone, today);
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
          scheduledDate: tomorrow,
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
      await db
        .update(tasks)
        .set({
          status: "dropped",
          droppedAt: new Date(),
          dropReason: res.reason.trim(),
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, res.taskId), eq(tasks.userId, userId)));
    }
  }

  const now = new Date();
  await db
    .insert(dayStatus)
    .values({
      userId,
      date: today,
      goalHitPercent: snap.goalHitPercent,
      isRed: snap.isRed,
      creditsEarned: snap.creditsEarned * mult,
      creditsSpent: snap.creditsSpent,
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
        creditsEarned: snap.creditsEarned * mult,
        creditsSpent: snap.creditsSpent,
        productivityScore: snap.productivityScore,
        scoreVsAvgDelta: scoreVsAvg,
        endedAt: now,
        updatedAt: now,
      },
    });

  await db
    .insert(dailyReviews)
    .values({
      userId,
      date: today,
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
  return { ok: true as const };
}

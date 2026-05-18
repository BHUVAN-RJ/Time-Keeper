"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  categories,
  dayStatus,
  projects,
  tasks,
  timeBlocks,
  weeklyReviews,
} from "@/db/schema";
import { and, count, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { getStaleProjects } from "@/actions/projects";
import { addDays, format, getDay, parseISO } from "date-fns";
import { getDayRangeUtc } from "@/lib/day-range";
import { overlapMinutes } from "@/lib/block-minutes";
import { estimateAccuracyByWeek } from "@/lib/estimate-weekly-trend";
import { retrospectiveWeekStart } from "@/lib/weekly-retro-week";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

/** Week retrospective not yet completed for the week that ended last Sunday. */
export async function getPendingWeeklyReview() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const weekStarting = retrospectiveWeekStart(today);

  const [existing] = await db
    .select({ completedAt: weeklyReviews.completedAt })
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.userId, userId),
        eq(weeklyReviews.weekStarting, weekStarting),
      ),
    )
    .limit(1);

  if (existing?.completedAt) {
    return { pending: false as const, weekStarting };
  }
  return { pending: true as const, weekStarting };
}

/** After closing today on Sunday evening — nudge user to Week tab (not a full retro modal). */
export async function getWeeklyReviewNudgeForEndDay(closeDay: string) {
  const { timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  if (closeDay !== today) return { show: false as const };
  if (getDay(parseISO(today)) !== 0) return { show: false as const };

  const pending = await getPendingWeeklyReview();
  if (!pending.pending) return { show: false as const };
  return { show: true as const, weekStarting: pending.weekStarting };
}

export async function getWeeklyReviewDraft(weekStarting: string) {
  const { userId, timezone } = await requireUser();
  const weekEnd = format(addDays(parseISO(weekStarting), 6), "yyyy-MM-dd");

  const statusRows = await db
    .select()
    .from(dayStatus)
    .where(
      and(
        eq(dayStatus.userId, userId),
        gte(dayStatus.date, weekStarting),
        lte(dayStatus.date, weekEnd),
        isNotNull(dayStatus.endedAt),
      ),
    );

  const avgScore =
    statusRows.length > 0
      ? Math.round(
          statusRows.reduce((s, r) => s + (r.productivityScore ?? 0), 0) /
            statusRows.length,
        )
      : null;

  const [completed] = await db
    .select({ n: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "completed"),
        gte(tasks.completedAt, parseISO(weekStarting)),
      ),
    );

  const [dropped] = await db
    .select({ n: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "dropped"),
        gte(tasks.droppedAt, parseISO(weekStarting)),
      ),
    );

  const rescheduled = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      rescheduleCount: tasks.rescheduleCount,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), gte(tasks.rescheduleCount, 1)))
    .orderBy(desc(tasks.rescheduleCount))
    .limit(1);

  const activeProjects = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.userId, userId), eq(projects.status, "active")),
    );

  const stale = await getStaleProjects();

  const rangeStart = getDayRangeUtc(parseISO(weekStarting), timezone).startUtc;
  const rangeEnd = getDayRangeUtc(parseISO(weekEnd), timezone).endUtc;

  const blockRows = await db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(
      and(
        eq(timeBlocks.userId, userId),
        isNotNull(timeBlocks.endAt),
        lte(timeBlocks.startAt, rangeEnd),
        gte(timeBlocks.endAt, rangeStart),
      ),
    );

  const minutesByCategory = new Map<
    string,
    { name: string; color: string; mins: number }
  >();
  for (const { block, category } of blockRows) {
    if (!block.endAt) continue;
    const mins = overlapMinutes(
      new Date(block.startAt),
      new Date(block.endAt),
      rangeStart,
      rangeEnd,
    );
    if (mins <= 0) continue;
    const cur = minutesByCategory.get(category.id) ?? {
      name: category.name,
      color: category.color,
      mins: 0,
    };
    cur.mins += mins;
    minutesByCategory.set(category.id, cur);
  }

  const categoryTotals = [...minutesByCategory.values()]
    .filter((c) => c.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const estimateAccuracyTrend = await estimateAccuracyByWeek(
    userId,
    weekStarting,
    4,
  );

  const [existing] = await db
    .select()
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.userId, userId),
        eq(weeklyReviews.weekStarting, weekStarting),
      ),
    )
    .limit(1);

  let commitments: string[] = [];
  if (existing?.commitmentsJson) {
    try {
      commitments = JSON.parse(existing.commitmentsJson) as string[];
    } catch {
      commitments = [];
    }
  }

  return {
    weekStarting,
    weekEnd,
    avgScore,
    tasksCompleted: completed?.n ?? 0,
    tasksDropped: dropped?.n ?? 0,
    avoidanceTask: rescheduled[0] ?? null,
    activeProjects,
    staleProjects: stale,
    categoryTotals,
    estimateAccuracyTrend,
    commitments,
    habitChangeNote: existing?.habitChangeNote ?? "",
    notes: existing?.notes ?? "",
    droppedProjectId: existing?.droppedProjectId ?? null,
  };
}

export async function submitWeeklyReviewAction(input: {
  weekStarting: string;
  commitments: string[];
  habitChangeNote?: string;
  notes?: string;
  droppedProjectId?: string | null;
  retireDropped?: boolean;
  retireReason?: string;
}) {
  const { userId } = await requireUser();
  const now = new Date();
  const commitments = input.commitments.map((c) => c.trim()).filter(Boolean).slice(0, 3);

  await db
    .insert(weeklyReviews)
    .values({
      userId,
      weekStarting: input.weekStarting,
      completedAt: now,
      commitmentsJson: JSON.stringify(commitments),
      habitChangeNote: input.habitChangeNote?.trim() || null,
      notes: input.notes?.trim() || null,
      droppedProjectId: input.droppedProjectId ?? null,
    })
    .onConflictDoUpdate({
      target: [weeklyReviews.userId, weeklyReviews.weekStarting],
      set: {
        completedAt: now,
        commitmentsJson: JSON.stringify(commitments),
        habitChangeNote: input.habitChangeNote?.trim() || null,
        notes: input.notes?.trim() || null,
        droppedProjectId: input.droppedProjectId ?? null,
      },
    });

  if (
    input.retireDropped &&
    input.droppedProjectId &&
    input.retireReason?.trim()
  ) {
    await db
      .update(projects)
      .set({
        status: "retired",
        retiredReason: input.retireReason.trim(),
        retiredAt: now,
      })
      .where(
        and(
          eq(projects.id, input.droppedProjectId),
          eq(projects.userId, userId),
        ),
      );
  }

  revalidatePath("/today");
  revalidatePath("/week");
  return { ok: true as const };
}

export async function getWeeklyCommitmentsForToday() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const ws = retrospectiveWeekStart(today);

  const [row] = await db
    .select({ commitmentsJson: weeklyReviews.commitmentsJson })
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.userId, userId),
        eq(weeklyReviews.weekStarting, ws),
        isNotNull(weeklyReviews.completedAt),
      ),
    )
    .limit(1);

  if (!row?.commitmentsJson) return [] as string[];
  try {
    return (JSON.parse(row.commitmentsJson) as unknown[]).filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
  } catch {
    return [];
  }
}

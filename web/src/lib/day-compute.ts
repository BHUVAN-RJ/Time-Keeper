import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  dayStatus,
  scheduleGoals,
  tasks,
  timeBlocks,
} from "@/db/schema";
import { overlapMinutes } from "@/lib/block-minutes";
import { normalizeQuality, qualityCreditMultiplier } from "@/lib/quality";
import { getDayRangeUtc } from "@/lib/day-range";
import { goalsForDay } from "@/lib/ensure-schedule-goals";
import { RED_DAY_THRESHOLD, WORK_CATEGORY_NAMES } from "@/lib/default-schedule-goals";
import { addDays, format, parseISO } from "date-fns";

export type CategoryGoalRow = {
  categoryId: string;
  categoryName: string;
  color: string;
  targetMinutes: number;
  actualMinutes: number;
  hitPercent: number;
};

export type DaySnapshot = {
  date: string;
  goalHitPercent: number;
  isRed: boolean;
  productivityScore: number;
  creditsEarned: number;
  creditsSpent: number;
  freeTimeSpentToday: number;
  workMinutes: number;
  workGoalMinutes: number;
  categoryGoals: CategoryGoalRow[];
  endedAt: Date | null;
  isOffDay: boolean;
  /** True when the day was closed or has time blocks / scheduled tasks. */
  hasActivity: boolean;
  scoreBreakdown: {
    timeComponent: number;
    habitComponent: number;
    taskComponent: number;
    qualityComponent: number;
    taskScore: number;
    qualityScore: number;
    habitsPercent: number;
    goalHitPercent: number;
  };
};

function dayHasActivity(
  statusRow: typeof dayStatus.$inferSelect | undefined,
  blockRows: BlockRow[],
  dayTasks: (typeof tasks.$inferSelect)[],
): boolean {
  if (statusRow?.endedAt) return true;
  if (blockRows.length > 0) return true;
  if (dayTasks.length > 0) return true;
  return false;
}

type BlockRow = {
  block: typeof timeBlocks.$inferSelect;
  category: typeof categories.$inferSelect;
};

async function blocksForDay(
  userId: string,
  date: string,
  timezone: string,
): Promise<BlockRow[]> {
  const { startUtc, endUtc } = getDayRangeUtc(parseISO(date), timezone);
  const rows = await db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(
      and(
        eq(timeBlocks.userId, userId),
        lte(timeBlocks.startAt, endUtc),
        or(isNull(timeBlocks.endAt), gte(timeBlocks.endAt, startUtc)),
      ),
    );
  return rows;
}

function minutesOnDay(
  rows: BlockRow[],
  date: string,
  timezone: string,
  categoryId?: string,
): number {
  const { startUtc, endUtc } = getDayRangeUtc(parseISO(date), timezone);
  let total = 0;
  for (const { block, category } of rows) {
    if (categoryId && category.id !== categoryId) continue;
    const end = block.endAt ? new Date(block.endAt) : new Date();
    total += overlapMinutes(
      new Date(block.startAt),
      end,
      startUtc,
      endUtc,
    );
  }
  return total;
}

function creditsForDay(rows: BlockRow[], date: string, timezone: string) {
  const { startUtc, endUtc } = getDayRangeUtc(parseISO(date), timezone);
  let earned = 0;
  let spent = 0;
  for (const { block, category } of rows) {
    if (!block.endAt || !block.quality) continue;
    const q = normalizeQuality(block.quality);
    if (!q) continue;
    const mins = overlapMinutes(
      new Date(block.startAt),
      new Date(block.endAt),
      startUtc,
      endUtc,
    );
    if (mins <= 0) continue;
    const hours = mins / 60;
    const raw = hours * category.baseCreditRate * qualityCreditMultiplier(q);
    if (category.isFreeTime) spent += raw;
    else earned += raw;
  }
  return { earned, spent };
}

const ACTIVE_TASK_STATUSES = ["scheduled", "in_progress", "completed"] as const;

function tasksForDay(
  rows: (typeof tasks.$inferSelect)[],
  date: string,
): (typeof tasks.$inferSelect)[] {
  return rows.filter(
    (t) =>
      ACTIVE_TASK_STATUSES.includes(
        t.status as (typeof ACTIVE_TASK_STATUSES)[number],
      ) &&
      (t.scheduledDate === date ||
        t.dueDate === date ||
        t.status === "in_progress"),
  );
}

function taskCompletionScoreFromRows(
  rows: (typeof tasks.$inferSelect)[],
): number {
  if (rows.length === 0) return 100;
  const done = rows.filter((t) => t.status === "completed").length;
  return Math.round((done / rows.length) * 100);
}

function qualityScore(rows: BlockRow[], date: string, timezone: string) {
  const { startUtc, endUtc } = getDayRangeUtc(parseISO(date), timezone);
  let useful = 0;
  let chores = 0;
  let meh = 0;
  let wasted = 0;
  for (const { block } of rows) {
    if (!block.endAt || !block.quality) continue;
    const q = normalizeQuality(block.quality);
    if (!q) continue;
    const mins = overlapMinutes(
      new Date(block.startAt),
      new Date(block.endAt),
      startUtc,
      endUtc,
    );
    if (q === "useful") useful += mins;
    else if (q === "chores") chores += mins;
    else if (q === "meh") meh += mins;
    else wasted += mins;
  }
  const denom = useful + chores + meh + wasted;
  if (denom <= 0) return 100;
  return Math.round((useful / denom) * 100);
}

type GoalRow = Awaited<ReturnType<typeof goalsForDay>>[number];

function activeGoalsForDay(goalRows: GoalRow[], date: string): GoalRow[] {
  return goalRows.filter(
    ({ goal }) =>
      goal.effectiveFrom <= date &&
      (goal.effectiveTo == null || goal.effectiveTo >= date),
  );
}

function buildDaySnapshot(
  date: string,
  timezone: string,
  statusRow: typeof dayStatus.$inferSelect | undefined,
  blockRows: BlockRow[],
  goalRows: GoalRow[],
  dayTasks: (typeof tasks.$inferSelect)[],
): DaySnapshot {
  const categoryGoals: CategoryGoalRow[] = goalRows.map(({ goal, category }) => {
    const actual = minutesOnDay(blockRows, date, timezone, category.id);
    const target = goal.targetMinutesPerDay;
    const hitPercent =
      target > 0 ? Math.min(150, Math.round((actual / target) * 100)) : 100;
    return {
      categoryId: category.id,
      categoryName: category.name,
      color: category.color,
      targetMinutes: target,
      actualMinutes: actual,
      hitPercent,
    };
  });

  let totalTarget = 0;
  let totalActual = 0;
  for (const g of categoryGoals) {
    if (g.targetMinutes <= 0) continue;
    totalTarget += g.targetMinutes;
    totalActual += g.actualMinutes;
  }
  const goalHitPercent =
    totalTarget > 0
      ? Math.round((totalActual / totalTarget) * 100)
      : 100;

  const habitsPercent = 100;
  const dayScore = 0.7 * goalHitPercent + 0.3 * habitsPercent;
  const isRed = dayScore < RED_DAY_THRESHOLD && !statusRow?.isOffDay;

  const taskScore = taskCompletionScoreFromRows(dayTasks);
  const qualScore = qualityScore(blockRows, date, timezone);
  const timeComponent = Math.round(0.4 * Math.min(100, goalHitPercent));
  const habitComponent = Math.round(0.3 * habitsPercent);
  const taskComponent = Math.round(0.2 * taskScore);
  const qualityComponent = Math.round(0.1 * qualScore);
  const productivityScore =
    timeComponent + habitComponent + taskComponent + qualityComponent;

  const { earned, spent } = creditsForDay(blockRows, date, timezone);
  let creditsEarned = earned;
  if (statusRow?.endedAt) {
    let mult = 1;
    if (goalHitPercent >= 100) mult = 1.5;
    else if (goalHitPercent >= 80) mult = 1.2;
    creditsEarned = earned * mult;
  }

  let workMinutes = 0;
  let workGoalMinutes = 0;
  for (const g of categoryGoals) {
    if (!WORK_CATEGORY_NAMES.has(g.categoryName)) continue;
    workMinutes += g.actualMinutes;
    workGoalMinutes += g.targetMinutes;
  }

  return {
    date,
    goalHitPercent,
    isRed,
    productivityScore,
    creditsEarned,
    creditsSpent: spent,
    freeTimeSpentToday: spent,
    workMinutes,
    workGoalMinutes,
    categoryGoals,
    endedAt: statusRow?.endedAt ? new Date(statusRow.endedAt) : null,
    isOffDay: !!statusRow?.isOffDay,
    hasActivity: dayHasActivity(statusRow, blockRows, dayTasks),
    scoreBreakdown: {
      timeComponent,
      habitComponent,
      taskComponent,
      qualityComponent,
      taskScore,
      qualityScore: qualScore,
      habitsPercent,
      goalHitPercent,
    },
  };
}

export async function computeDaySnapshot(
  userId: string,
  date: string,
  timezone: string,
): Promise<DaySnapshot> {
  const [statusRow] = await db
    .select()
    .from(dayStatus)
    .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, date)))
    .limit(1);

  const blockRows = await blocksForDay(userId, date, timezone);
  const goalRows = await goalsForDay(userId, date);
  const dayTasks = tasksForDay(
    await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          inArray(tasks.status, [...ACTIVE_TASK_STATUSES]),
          or(
            eq(tasks.scheduledDate, date),
            eq(tasks.dueDate, date),
            eq(tasks.status, "in_progress"),
          ),
        ),
      ),
    date,
  );

  return buildDaySnapshot(
    date,
    timezone,
    statusRow,
    blockRows,
    goalRows,
    dayTasks,
  );
}

async function blocksForRange(
  userId: string,
  startDate: string,
  endDate: string,
  timezone: string,
): Promise<BlockRow[]> {
  const { startUtc } = getDayRangeUtc(parseISO(startDate), timezone);
  const { endUtc } = getDayRangeUtc(parseISO(endDate), timezone);
  return db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(
      and(
        eq(timeBlocks.userId, userId),
        lte(timeBlocks.startAt, endUtc),
        or(isNull(timeBlocks.endAt), gte(timeBlocks.endAt, startUtc)),
      ),
    );
}

/** Batch-compute 7 days with a handful of DB round-trips (for /week). */
export async function computeWeekSnapshots(
  userId: string,
  weekStartMonday: string,
  timezone: string,
): Promise<DaySnapshot[]> {
  const dates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStartMonday), i), "yyyy-MM-dd"),
  );
  const weekEnd = dates[6]!;

  const [allBlocks, statusRows, allGoals, allTasks] = await Promise.all([
    blocksForRange(userId, weekStartMonday, weekEnd, timezone),
    db
      .select()
      .from(dayStatus)
      .where(
        and(eq(dayStatus.userId, userId), inArray(dayStatus.date, dates)),
      ),
    db
      .select({ goal: scheduleGoals, category: categories })
      .from(scheduleGoals)
      .innerJoin(categories, eq(scheduleGoals.categoryId, categories.id))
      .where(
        and(
          eq(scheduleGoals.userId, userId),
          lte(scheduleGoals.effectiveFrom, weekEnd),
          or(
            isNull(scheduleGoals.effectiveTo),
            gte(scheduleGoals.effectiveTo, weekStartMonday),
          ),
        ),
      ),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          inArray(tasks.status, [...ACTIVE_TASK_STATUSES]),
          or(
            inArray(tasks.scheduledDate, dates),
            inArray(tasks.dueDate, dates),
            eq(tasks.status, "in_progress"),
          ),
        ),
      ),
  ]);

  const statusByDate = new Map(statusRows.map((r) => [r.date, r]));

  return dates.map((date) => {
    const blockRows = allBlocks.filter(({ block }) => {
      const { startUtc, endUtc } = getDayRangeUtc(parseISO(date), timezone);
      const end = block.endAt ? new Date(block.endAt) : new Date();
      return (
        new Date(block.startAt) <= endUtc &&
        end >= startUtc
      );
    });
    return buildDaySnapshot(
      date,
      timezone,
      statusByDate.get(date),
      blockRows,
      activeGoalsForDay(allGoals, date),
      tasksForDay(allTasks, date),
    );
  });
}

export async function rollingProductivityAvg(
  userId: string,
  timezone: string,
  throughDate: string,
  days = 7,
): Promise<number | null> {
  const base = parseISO(throughDate);
  const dates = Array.from({ length: days }, (_, i) =>
    format(addDays(base, -(i + 1)), "yyyy-MM-dd"),
  );
  const snaps = await Promise.all(
    dates.map((d) => computeDaySnapshot(userId, d, timezone)),
  );
  const scores = snaps
    .filter((s) => s.hasActivity)
    .map((s) => s.productivityScore);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** v0.4: compare rolling avg now vs 7 days ago; store slump_mode when delta <= -15. */
export async function computeSlumpModeStub(
  userId: string,
  timezone: string,
  throughDate: string,
): Promise<{ slumpMode: boolean; delta: number | null }> {
  const current = await rollingProductivityAvg(userId, timezone, throughDate, 7);
  const base = parseISO(throughDate);
  const weekAgo = format(addDays(base, -7), "yyyy-MM-dd");
  const prior = await rollingProductivityAvg(userId, timezone, weekAgo, 7);
  if (current == null || prior == null) {
    return { slumpMode: false, delta: null };
  }
  const delta = current - prior;
  // TODO(v0.4): persist slump_mode on user; gate PM Review UI when true
  return { slumpMode: delta <= -15, delta };
}

export function dayCreditMultiplier(goalHitPercent: number) {
  if (goalHitPercent >= 100) return 1.5;
  if (goalHitPercent >= 80) return 1.2;
  return 1;
}

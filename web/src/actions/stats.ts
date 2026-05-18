"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, dailyReviews, projects, tasks, timeBlocks } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, or } from "drizzle-orm";
import {
  computeDaySnapshot,
  computeSlumpModeStub,
  rollingProductivityAvg,
} from "@/lib/day-compute";
import { calendarDayInTz } from "@/lib/calendar-day";
import { getDayRangeUtc } from "@/lib/day-range";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { normalizeQuality, qualityCreditMultiplier } from "@/lib/quality";
import { addDays, format, parseISO } from "date-fns";

const HISTORY_DAYS = 30;

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export type CompletedTaskHistoryRow = {
  id: string;
  title: string;
  description: string | null;
  estimateMinutes: number;
  actualMinutes: number;
  completedAt: string;
  categoryName: string | null;
  categoryColor: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
};

export type DroppedTaskHistoryRow = {
  id: string;
  title: string;
  description: string | null;
  estimateMinutes: number;
  dropReason: string;
  droppedAt: string;
  categoryName: string | null;
  categoryColor: string | null;
  rescheduleCount: number;
};

export type DayNoteHistoryRow = {
  date: string;
  mood: number | null;
  notes: string | null;
  tomorrowsTop3: string[];
  closedAt: string | null;
};

export type TimeBlockHistoryRow = {
  id: string;
  label: string | null;
  categoryName: string;
  categoryColor: string;
  startAt: string;
  endAt: string;
  quality: string | null;
  notes: string | null;
  manualEntry: boolean;
};

function historySinceUtc(today: string, timezone: string): Date {
  const sinceDate = format(
    addDays(parseISO(today), -(HISTORY_DAYS - 1)),
    "yyyy-MM-dd",
  );
  return getDayRangeUtc(parseISO(sinceDate), timezone).startUtc;
}

function parseTomorrowsPlan(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export async function getStatsPageData() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const sinceDate = format(
    addDays(parseISO(today), -(HISTORY_DAYS - 1)),
    "yyyy-MM-dd",
  );
  const sinceUtc = historySinceUtc(today, timezone);

  const snap = await computeDaySnapshot(userId, today, timezone);
  const rollingAvg = await rollingProductivityAvg(userId, timezone, today);
  const slump = await computeSlumpModeStub(userId, timezone, today);

  const blocks = await db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(eq(timeBlocks.userId, userId));

  let earned = 0;
  let spent = 0;
  for (const { block, category } of blocks) {
    if (!block.endAt || !block.quality) continue;
    const q = normalizeQuality(block.quality);
    if (!q) continue;
    const mins =
      (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) /
      60_000;
    const raw =
      (mins / 60) * category.baseCreditRate * qualityCreditMultiplier(q);
    if (category.isFreeTime) spent += raw;
    else earned += raw;
  }

  const trend: { date: string; score: number }[] = [];
  const base = parseISO(today);
  for (let i = 13; i >= 0; i--) {
    const d = format(addDays(base, -i), "yyyy-MM-dd");
    const s = await computeDaySnapshot(userId, d, timezone);
    if (s.hasActivity || s.endedAt) {
      trend.push({ date: d, score: s.productivityScore });
    }
  }

  const [completedRows, droppedRows, reviewRows, recentBlocks] =
    await Promise.all([
      db
        .select({
          task: tasks,
          categoryName: categories.name,
          categoryColor: categories.color,
        })
        .from(tasks)
        .leftJoin(categories, eq(tasks.categoryId, categories.id))
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, "completed"),
            isNotNull(tasks.completedAt),
            gte(tasks.completedAt, sinceUtc),
          ),
        )
        .orderBy(desc(tasks.completedAt)),
      db
        .select({
          task: tasks,
          categoryName: categories.name,
          categoryColor: categories.color,
        })
        .from(tasks)
        .leftJoin(categories, eq(tasks.categoryId, categories.id))
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, "dropped"),
            isNotNull(tasks.droppedAt),
            gte(tasks.droppedAt, sinceUtc),
          ),
        )
        .orderBy(desc(tasks.droppedAt)),
      db
        .select()
        .from(dailyReviews)
        .where(
          and(
            eq(dailyReviews.userId, userId),
            gte(dailyReviews.date, sinceDate),
            or(
              isNotNull(dailyReviews.notes),
              isNotNull(dailyReviews.mood),
              isNotNull(dailyReviews.pmCompletedAt),
              isNotNull(dailyReviews.tomorrowsPlanJson),
            ),
          ),
        )
        .orderBy(desc(dailyReviews.date)),
      db
        .select({
          block: timeBlocks,
          categoryName: categories.name,
          categoryColor: categories.color,
        })
        .from(timeBlocks)
        .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
        .where(
          and(
            eq(timeBlocks.userId, userId),
            isNotNull(timeBlocks.endAt),
            gte(timeBlocks.endAt, sinceUtc),
          ),
        )
        .orderBy(desc(timeBlocks.endAt))
        .limit(50),
    ]);

  const completed: CompletedTaskHistoryRow[] = completedRows.map((r) => ({
    id: r.task.id,
    title: r.task.title,
    description: r.task.description,
    estimateMinutes: r.task.estimateMinutes,
    actualMinutes: r.task.actualMinutes,
    completedAt: new Date(r.task.completedAt!).toISOString(),
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    dueDate: r.task.dueDate,
    scheduledDate: r.task.scheduledDate,
  }));

  const dropped: DroppedTaskHistoryRow[] = droppedRows.map((r) => ({
    id: r.task.id,
    title: r.task.title,
    description: r.task.description,
    estimateMinutes: r.task.estimateMinutes,
    dropReason: r.task.dropReason ?? "",
    droppedAt: new Date(r.task.droppedAt!).toISOString(),
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    rescheduleCount: r.task.rescheduleCount,
  }));

  const dayNotes: DayNoteHistoryRow[] = reviewRows.map((r) => ({
    date: r.date,
    mood: r.mood,
    notes: r.notes,
    tomorrowsTop3: parseTomorrowsPlan(r.tomorrowsPlanJson),
    closedAt: r.pmCompletedAt
      ? new Date(r.pmCompletedAt).toISOString()
      : null,
  }));

  const timeBlocksHistory: TimeBlockHistoryRow[] = recentBlocks.map((r) => ({
    id: r.block.id,
    label: r.block.label,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    startAt: new Date(r.block.startAt).toISOString(),
    endAt: new Date(r.block.endAt!).toISOString(),
    quality: r.block.quality,
    notes: r.block.notes,
    manualEntry: r.block.manualEntry,
  }));

  const retired = await db
    .select({ reason: projects.retiredReason })
    .from(projects)
    .where(
      and(eq(projects.userId, userId), eq(projects.status, "retired")),
    );

  const retirementPatterns: { label: string; count: number }[] = [];
  const bucket = (text: string | null) => {
    if (!text?.trim()) return;
    const key = text.trim().slice(0, 80);
    const found = retirementPatterns.find((x) => x.label === key);
    if (found) found.count += 1;
    else retirementPatterns.push({ label: key, count: 1 });
  };
  for (const d of dropped) bucket(d.dropReason);
  for (const r of retired) bucket(r.reason);
  retirementPatterns.sort((a, b) => b.count - a.count);

  return {
    timezone,
    today,
    historyDays: HISTORY_DAYS,
    retirementPatterns: retirementPatterns.slice(0, 12),
    todayScore: snap.productivityScore,
    rollingAvg,
    scoreVsAvg:
      rollingAvg != null ? snap.productivityScore - rollingAvg : null,
    trend,
    creditBalance: earned - spent,
    slumpModeStub: slump.slumpMode,
    slumpDeltaStub: slump.delta,
    completed,
    dropped,
    dayNotes,
    timeBlocksHistory,
  };
}

"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  categories,
  dayStatus,
  productivityScores,
  tags,
  timeBlocks,
  timeBlockTags,
} from "@/db/schema";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { calendarDayInTz } from "@/lib/calendar-day";
import { getDayRangeUtc } from "@/lib/day-range";
import { overlapMinutes } from "@/lib/block-minutes";
import { getTagsEnabledForUser } from "@/actions/preferences";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { normalizeQuality, qualityLabel } from "@/lib/quality";
import {
  buildMonthCalendarCells,
  daysInMonth,
  monthHeadlineLabel,
  previousMonthStart,
  type MonthStatusRow,
} from "@/lib/month-recap";
import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

function avgScore(
  scores: number[],
): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

async function loadMonthStatus(
  userId: string,
  monthStart: string,
  monthEnd: string,
) {
  const rows = await db
    .select({
      date: dayStatus.date,
      endedAt: dayStatus.endedAt,
      isRed: dayStatus.isRed,
      isOffDay: dayStatus.isOffDay,
      isVacation: dayStatus.isVacation,
      productivityScore: dayStatus.productivityScore,
    })
    .from(dayStatus)
    .where(
      and(
        eq(dayStatus.userId, userId),
        gte(dayStatus.date, monthStart),
        lte(dayStatus.date, monthEnd),
      ),
    );

  const statusByDate = new Map<string, MonthStatusRow>();
  for (const r of rows) {
    statusByDate.set(r.date, {
      date: r.date,
      endedAt: r.endedAt ? new Date(r.endedAt) : null,
      isRed: r.isRed,
      isOffDay: r.isOffDay,
      isVacation: r.isVacation,
      productivityScore: r.productivityScore,
    });
  }
  return statusByDate;
}

async function loadMonthScores(
  userId: string,
  monthStart: string,
  monthEnd: string,
) {
  const rows = await db
    .select({
      date: productivityScores.date,
      score: productivityScores.score,
    })
    .from(productivityScores)
    .where(
      and(
        eq(productivityScores.userId, userId),
        gte(productivityScores.date, monthStart),
        lte(productivityScores.date, monthEnd),
      ),
    );
  return new Map(rows.map((r) => [r.date, r.score]));
}

function summarizeMonth(
  monthStart: string,
  monthEnd: string,
  today: string,
  statusByDate: Map<string, MonthStatusRow>,
  scoreByDate: Map<string, number>,
) {
  const cells = buildMonthCalendarCells(
    monthStart,
    monthEnd,
    today,
    statusByDate,
    scoreByDate,
  );

  const dayCells = cells.filter((c): c is NonNullable<typeof c> => c != null);
  const tracked = dayCells.filter(
    (c) => c.state === "scored" || c.state === "red",
  );
  const scores = tracked
    .map((c) => c.score)
    .filter((s): s is number => s != null);
  const redDays = dayCells.filter((c) => c.state === "red").length;

  let bestDay: { date: string; score: number } | null = null;
  for (const c of tracked) {
    if (c.score == null) continue;
    if (!bestDay || c.score > bestDay.score) {
      bestDay = { date: c.date, score: c.score };
    }
  }

  return {
    calendarCells: cells,
    daysTracked: tracked.length,
    redDays,
    avgScore: avgScore(scores),
    bestDay,
  };
}

export async function getMonthPageData(month?: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const base = month
    ? parseISO(`${month}-01`)
    : parseISO(`${today.slice(0, 7)}-01`);
  const monthStart = format(startOfMonth(base), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(base), "yyyy-MM-dd");
  const totalDaysInMonth = daysInMonth(monthStart);

  const [statusByDate, scoreByDate] = await Promise.all([
    loadMonthStatus(userId, monthStart, monthEnd),
    loadMonthScores(userId, monthStart, monthEnd),
  ]);

  const summary = summarizeMonth(
    monthStart,
    monthEnd,
    today,
    statusByDate,
    scoreByDate,
  );

  const prevStart = previousMonthStart(monthStart);
  const prevEnd = format(endOfMonth(parseISO(prevStart)), "yyyy-MM-dd");
  const [prevStatus, prevScores] = await Promise.all([
    loadMonthStatus(userId, prevStart, prevEnd),
    loadMonthScores(userId, prevStart, prevEnd),
  ]);
  const prevSummary = summarizeMonth(
    prevStart,
    prevEnd,
    today,
    prevStatus,
    prevScores,
  );
  const lastMonthAvgScore = prevSummary.avgScore;

  const rangeStart = getDayRangeUtc(parseISO(monthStart), timezone).startUtc;
  const rangeEnd = getDayRangeUtc(parseISO(monthEnd), timezone).endUtc;

  const blocks = await db
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

  for (const { block, category } of blocks) {
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

  const categoryMinutes = [...minutesByCategory.values()]
    .filter((c) => c.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const maxCategoryMins =
    categoryMinutes.length > 0 ? categoryMinutes[0]!.mins : 1;

  const scoreTrend = summary.calendarCells
    .filter((c): c is NonNullable<typeof c> => c != null)
    .filter((c) => c.score != null && c.state !== "future")
    .map((c) => ({ date: c.date, score: c.score! }));

  const tagsEnabled = await getTagsEnabledForUser(userId);
  const minutesByTag = new Map<string, { name: string; mins: number }>();
  const minutesByQuality = new Map<string, number>();

  if (tagsEnabled) {
    const taggedBlocks = await db
      .select({
        block: timeBlocks,
        tagName: tags.name,
      })
      .from(timeBlocks)
      .innerJoin(timeBlockTags, eq(timeBlockTags.timeBlockId, timeBlocks.id))
      .innerJoin(tags, eq(timeBlockTags.tagId, tags.id))
      .where(
        and(
          eq(timeBlocks.userId, userId),
          isNotNull(timeBlocks.endAt),
          lte(timeBlocks.startAt, rangeEnd),
          gte(timeBlocks.endAt, rangeStart),
        ),
      );

    for (const { block, tagName } of taggedBlocks) {
      if (!block.endAt) continue;
      const mins = overlapMinutes(
        new Date(block.startAt),
        new Date(block.endAt),
        rangeStart,
        rangeEnd,
      );
      if (mins <= 0) continue;
      const cur = minutesByTag.get(tagName) ?? { name: tagName, mins: 0 };
      cur.mins += mins;
      minutesByTag.set(tagName, cur);
    }
  }

  for (const { block } of blocks) {
    if (!block.endAt) continue;
    const q = normalizeQuality(block.quality);
    if (!q) continue;
    const mins = overlapMinutes(
      new Date(block.startAt),
      new Date(block.endAt),
      rangeStart,
      rangeEnd,
    );
    if (mins <= 0) continue;
    minutesByQuality.set(q, (minutesByQuality.get(q) ?? 0) + mins);
  }

  const tagBreakdown = [...minutesByTag.values()]
    .filter((t) => t.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const qualityBreakdown = [...minutesByQuality.entries()]
    .map(([quality, mins]) => ({
      quality,
      label: qualityLabel(quality),
      mins,
    }))
    .sort((a, b) => b.mins - a.mins);

  const maxTagMins =
    tagBreakdown.length > 0 ? tagBreakdown[0]!.mins : 1;
  const maxQualityMins =
    qualityBreakdown.length > 0 ? qualityBreakdown[0]!.mins : 1;

  return {
    timezone,
    today,
    monthStart,
    monthEnd,
    headlineMonth: monthHeadlineLabel(monthStart),
    totalDaysInMonth,
    daysTracked: summary.daysTracked,
    redDays: summary.redDays,
    avgScore: summary.avgScore,
    lastMonthAvgScore,
    bestDay: summary.bestDay,
    calendarCells: summary.calendarCells,
    categoryMinutes,
    maxCategoryMins,
    scoreTrend,
    tagBreakdown,
    maxTagMins,
    qualityBreakdown,
    maxQualityMins,
    tagsEnabled,
  };
}

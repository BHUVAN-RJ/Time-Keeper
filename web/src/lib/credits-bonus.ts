import { db } from "@/db";
import { dayStatus, timeBlocks } from "@/db/schema";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { getDayRangeUtc } from "@/lib/day-range";
import { normalizeQuality } from "@/lib/quality";
import { addDays, format, parseISO, startOfWeek, endOfWeek } from "date-fns";

/** ISO week start (Monday) for a calendar day string. */
export function weekStartMonday(dateStr: string): string {
  const d = parseISO(dateStr);
  const mon = startOfWeek(d, { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

export async function hasVariableBonusThisWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<boolean> {
  const { startUtc } = getDayRangeUtc(parseISO(weekStart), "UTC");
  const { endUtc } = getDayRangeUtc(parseISO(weekEnd), "UTC");
  const rows = await db
    .select({ id: timeBlocks.id })
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.userId, userId),
        eq(timeBlocks.randomBonusApplied, true),
        isNotNull(timeBlocks.endAt),
        gte(timeBlocks.endAt, startUtc),
        lte(timeBlocks.endAt, endUtc),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Adaptive-ish probability: ~1 bonus per week if user stops ~5 useful blocks. */
export function variableBonusProbability(usefulBlocksThisWeek: number): number {
  if (usefulBlocksThisWeek <= 0) return 0.15;
  if (usefulBlocksThisWeek >= 5) return 0;
  return Math.max(0.05, 0.2 - usefulBlocksThisWeek * 0.04);
}

export async function tryApplyVariableBonus(params: {
  userId: string;
  blockId: string;
  quality: string;
  startAt: Date;
  endAt: Date;
  baseCreditRatePerHour: number;
  timezone: string;
}): Promise<{ applied: boolean; bonusCredits: number }> {
  if (normalizeQuality(params.quality) !== "useful") {
    return { applied: false, bonusCredits: 0 };
  }

  const closeDay = format(params.endAt, "yyyy-MM-dd");
  const ws = weekStartMonday(closeDay);
  const we = format(
    endOfWeek(parseISO(closeDay), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );

  if (await hasVariableBonusThisWeek(params.userId, ws, we)) {
    return { applied: false, bonusCredits: 0 };
  }

  const { startUtc, endUtc } = getDayRangeUtc(parseISO(ws), params.timezone);
  const weekBlocks = await db
    .select({ quality: timeBlocks.quality })
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.userId, params.userId),
        isNotNull(timeBlocks.endAt),
        gte(timeBlocks.endAt, startUtc),
        lte(timeBlocks.endAt, endUtc),
      ),
    );

  const usefulCount = weekBlocks.filter(
    (b) => normalizeQuality(b.quality) === "useful",
  ).length;

  const p = variableBonusProbability(usefulCount);
  if (Math.random() > p) {
    return { applied: false, bonusCredits: 0 };
  }

  await db
    .update(timeBlocks)
    .set({ randomBonusApplied: true, updatedAt: new Date() })
    .where(eq(timeBlocks.id, params.blockId));

  return { applied: true, bonusCredits: 0 };
}

/** Sunday recalc: bonus minutes credited as equivalent (spec §6.2). */
export async function weeklyCreditBonusMinutes(
  userId: string,
  weekStart: string,
): Promise<number> {
  const end = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const rows = await db
    .select({ goalHitPercent: dayStatus.goalHitPercent })
    .from(dayStatus)
    .where(
      and(
        eq(dayStatus.userId, userId),
        gte(dayStatus.date, weekStart),
        lte(dayStatus.date, end),
        isNotNull(dayStatus.endedAt),
      ),
    );

  const daysHit100 = rows.filter((r) => (r.goalHitPercent ?? 0) >= 100).length;
  if (daysHit100 >= 5) return 30;
  if (daysHit100 >= 3) return 15;
  return 0;
}

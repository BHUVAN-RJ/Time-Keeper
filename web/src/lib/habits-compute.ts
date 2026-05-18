import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  dayStatus,
  habitDaily,
  habits,
  habitStreaks,
  type habits as habitsTable,
} from "@/db/schema";
import { calendarDayInTz } from "@/lib/calendar-day";
import { addDays, format, parseISO, subDays } from "date-fns";

const FREEZE_CAP = 5;
const MONTHLY_FREEZE_GRANT = 2;

export type HabitRow = typeof habitsTable.$inferSelect;

export type HabitStreakRow = typeof habitStreaks.$inferSelect;

export type HabitDailyRow = typeof habitDaily.$inferSelect;

export type HabitDayCell = {
  date: string;
  count: number;
  target: number;
  hit: boolean;
  freezeUsed: boolean;
  offDaySkipped: boolean;
};

export type HabitWithStreak = HabitRow & {
  streak: HabitStreakRow;
  todayCount: number;
  todayHit: boolean;
  offDayPaused: boolean;
};

function monthKeyForDate(date: string): string {
  return date.slice(0, 7);
}

function dayHit(
  count: number,
  target: number,
  opts: { freezeUsed?: boolean; offDaySkipped?: boolean },
): boolean {
  if (opts.offDaySkipped) return true;
  return count >= target || !!opts.freezeUsed;
}

export async function isOffDayForUser(
  userId: string,
  date: string,
): Promise<boolean> {
  const [row] = await db
    .select({ isOffDay: dayStatus.isOffDay })
    .from(dayStatus)
    .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, date)))
    .limit(1);
  return !!row?.isOffDay;
}

export async function isVacationForUser(
  userId: string,
  date: string,
): Promise<boolean> {
  const [row] = await db
    .select({ isVacation: dayStatus.isVacation })
    .from(dayStatus)
    .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, date)))
    .limit(1);
  return !!row?.isVacation;
}

export const applyVacationHabitSkips = applyOffDayHabitSkips;

export async function clearVacationHabitSkips(
  userId: string,
  date: string,
  timezone: string,
): Promise<void> {
  if (await isOffDayForUser(userId, date)) return;
  await clearOffDayHabitSkips(userId, date, timezone);
}

/** Rest day: habits count as hit without using ❄ freeze bank. */
export async function applyOffDayHabitSkips(
  userId: string,
  date: string,
  timezone: string,
): Promise<void> {
  const active = await listActiveHabits(userId);
  if (active.length === 0) return;

  const now = new Date();
  for (const habit of active) {
    const dailyRows = await fetchDailyRows(userId, [habit.id], date, date);
    const prev = dailyRows[0]?.completionCount ?? 0;
    await db
      .insert(habitDaily)
      .values({
        userId,
        habitId: habit.id,
        date,
        completionCount: prev,
        freezeUsed: false,
        offDaySkipped: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [habitDaily.userId, habitDaily.habitId, habitDaily.date],
        set: { offDaySkipped: true, updatedAt: now },
      });
  }
  await recomputeAllHabitStreaks(userId, timezone, date);
}

export async function clearOffDayHabitSkips(
  userId: string,
  date: string,
  timezone: string,
): Promise<void> {
  const active = await listActiveHabits(userId);
  if (active.length === 0) return;

  const now = new Date();
  for (const habit of active) {
    await db
      .update(habitDaily)
      .set({ offDaySkipped: false, updatedAt: now })
      .where(
        and(
          eq(habitDaily.userId, userId),
          eq(habitDaily.habitId, habit.id),
          eq(habitDaily.date, date),
        ),
      );
  }
  await recomputeAllHabitStreaks(userId, timezone, date);
}

export function listDatesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = format(addDays(parseISO(cur), 1), "yyyy-MM-dd");
  }
  return out;
}

export async function listActiveHabits(userId: string): Promise<HabitRow[]> {
  return db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        eq(habits.active, true),
        isNull(habits.archivedAt),
      ),
    )
    .orderBy(habits.createdAt);
}

/** Habits that are active and not archived. */
export async function listManageableHabits(userId: string): Promise<HabitRow[]> {
  const rows = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(habits.createdAt);
  return rows.filter((h) => h.active && !h.archivedAt);
}

export async function fetchDailyRows(
  userId: string,
  habitIds: string[],
  startDate: string,
  endDate: string,
): Promise<HabitDailyRow[]> {
  if (habitIds.length === 0) return [];
  return db
    .select()
    .from(habitDaily)
    .where(
      and(
        eq(habitDaily.userId, userId),
        inArray(habitDaily.habitId, habitIds),
        gte(habitDaily.date, startDate),
        lte(habitDaily.date, endDate),
      ),
    );
}

function dailyMap(rows: HabitDailyRow[]): Map<string, HabitDailyRow> {
  const m = new Map<string, HabitDailyRow>();
  for (const r of rows) m.set(`${r.habitId}:${r.date}`, r);
  return m;
}

export function computeStreakMetrics(
  habit: HabitRow,
  dailyByDate: Map<string, HabitDailyRow>,
  throughDate: string,
): Pick<
  HabitStreakRow,
  "currentStreak" | "longestStreak" | "daysHitLast30" | "lastCompletedDate"
> {
  const target = habit.targetPerDay;
  const windowStart = format(subDays(parseISO(throughDate), 29), "yyyy-MM-dd");
  const dates = listDatesInclusive(windowStart, throughDate);

  let daysHitLast30 = 0;
  let lastCompletedDate: string | null = null;

  for (const d of dates) {
    const row = dailyByDate.get(`${habit.id}:${d}`);
    const count = row?.completionCount ?? 0;
    const freeze = row?.freezeUsed ?? false;
    const off = row?.offDaySkipped ?? false;
    if (dayHit(count, target, { freezeUsed: freeze, offDaySkipped: off })) {
      daysHitLast30 += 1;
      if (count >= target) lastCompletedDate = d;
    }
  }

  let currentStreak = 0;
  let d = throughDate;
  while (true) {
    const row = dailyByDate.get(`${habit.id}:${d}`);
    const count = row?.completionCount ?? 0;
    const freeze = row?.freezeUsed ?? false;
    const off = row?.offDaySkipped ?? false;
    if (!dayHit(count, target, { freezeUsed: freeze, offDaySkipped: off })) break;
    currentStreak += 1;
    const prev = format(subDays(parseISO(d), 1), "yyyy-MM-dd");
    if (prev === d) break;
    d = prev;
  }

  let longestStreak = 0;
  let run = 0;
  const historyStart = format(subDays(parseISO(throughDate), 120), "yyyy-MM-dd");
  for (const day of listDatesInclusive(historyStart, throughDate)) {
    const row = dailyByDate.get(`${habit.id}:${day}`);
    const count = row?.completionCount ?? 0;
    const freeze = row?.freezeUsed ?? false;
    const off = row?.offDaySkipped ?? false;
    if (dayHit(count, target, { freezeUsed: freeze, offDaySkipped: off })) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    daysHitLast30,
    lastCompletedDate,
  };
}

export async function ensureStreakRow(habitId: string): Promise<HabitStreakRow> {
  const [existing] = await db
    .select()
    .from(habitStreaks)
    .where(eq(habitStreaks.habitId, habitId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(habitStreaks)
    .values({
      habitId,
      freezesAvailable: MONTHLY_FREEZE_GRANT,
      freezeMonthKey: monthKeyForDate(
        calendarDayInTz(new Date(), "UTC"),
      ),
    })
    .returning();
  return created!;
}

export function applyMonthlyFreezeGrant(
  streak: HabitStreakRow,
  today: string,
): { freezesAvailable: number; freezesUsedThisMonth: number; freezeMonthKey: string } {
  const key = monthKeyForDate(today);
  if (streak.freezeMonthKey === key) {
    return {
      freezesAvailable: streak.freezesAvailable,
      freezesUsedThisMonth: streak.freezesUsedThisMonth,
      freezeMonthKey: streak.freezeMonthKey ?? key,
    };
  }
  const granted = Math.min(
    FREEZE_CAP,
    streak.freezesAvailable + MONTHLY_FREEZE_GRANT,
  );
  return {
    freezesAvailable: granted,
    freezesUsedThisMonth: 0,
    freezeMonthKey: key,
  };
}

export async function upsertHabitDailyCount(
  userId: string,
  habitId: string,
  date: string,
  completionCount: number,
): Promise<void> {
  const now = new Date();
  await db
    .insert(habitDaily)
    .values({
      userId,
      habitId,
      date,
      completionCount,
      freezeUsed: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [habitDaily.userId, habitDaily.habitId, habitDaily.date],
      set: { completionCount, updatedAt: now },
    });
}

export async function recomputeHabitStreak(
  userId: string,
  habit: HabitRow,
  throughDate: string,
): Promise<HabitStreakRow> {
  const streak = await ensureStreakRow(habit.id);
  const grant = applyMonthlyFreezeGrant(streak, throughDate);

  const historyStart = format(subDays(parseISO(throughDate), 120), "yyyy-MM-dd");
  const dailyRows = await fetchDailyRows(
    userId,
    [habit.id],
    historyStart,
    throughDate,
  );
  const byDate = dailyMap(dailyRows);
  const metrics = computeStreakMetrics(habit, byDate, throughDate);

  const [updated] = await db
    .update(habitStreaks)
    .set({
      ...metrics,
      ...grant,
      updatedAt: new Date(),
    })
    .where(eq(habitStreaks.habitId, habit.id))
    .returning();
  return updated!;
}

export async function recomputeAllHabitStreaks(
  userId: string,
  timezone: string,
  throughDate?: string,
): Promise<void> {
  const today = throughDate ?? calendarDayInTz(new Date(), timezone);
  const active = await listActiveHabits(userId);
  await Promise.all(
    active.map((h) => recomputeHabitStreak(userId, h, today)),
  );
}

export type HabitDayRecap = {
  id: string;
  name: string;
  targetPerDay: number;
  count: number;
  hit: boolean;
  freezeUsed: boolean;
  offDaySkipped: boolean;
};

/** Read-only habit hit/miss for a calendar day (no streak recompute). */
export async function habitsRecapForDate(
  userId: string,
  date: string,
): Promise<HabitDayRecap[]> {
  const active = await listActiveHabits(userId);
  if (active.length === 0) return [];

  const dailyRows = await fetchDailyRows(
    userId,
    active.map((h) => h.id),
    date,
    date,
  );
  const byDate = dailyMap(dailyRows);

  return active.map((h) => {
    const row = byDate.get(`${h.id}:${date}`);
    const count = row?.completionCount ?? 0;
    const freezeUsed = row?.freezeUsed ?? false;
    const offDaySkipped = row?.offDaySkipped ?? false;
    return {
      id: h.id,
      name: h.name,
      targetPerDay: h.targetPerDay,
      count,
      hit: dayHit(count, h.targetPerDay, {
        freezeUsed,
        offDaySkipped,
      }),
      freezeUsed,
      offDaySkipped,
    };
  });
}

export async function habitsCompletionPercentForDay(
  userId: string,
  date: string,
): Promise<number> {
  if (await isOffDayForUser(userId, date)) return 100;
  if (await isVacationForUser(userId, date)) return 100;

  const active = await listActiveHabits(userId);
  if (active.length === 0) return 100;

  const dailyRows = await fetchDailyRows(
    userId,
    active.map((h) => h.id),
    date,
    date,
  );
  const byDate = dailyMap(dailyRows);

  let hit = 0;
  for (const h of active) {
    const row = byDate.get(`${h.id}:${date}`);
    const count = row?.completionCount ?? 0;
    const freeze = row?.freezeUsed ?? false;
    const off = row?.offDaySkipped ?? false;
    if (dayHit(count, h.targetPerDay, { freezeUsed: freeze, offDaySkipped: off }))
      hit += 1;
  }
  return Math.round((hit / active.length) * 100);
}

export function buildHeatmapCells(
  habit: HabitRow,
  dailyRows: HabitDailyRow[],
  endDate: string,
  days = 14,
): HabitDayCell[] {
  const start = format(subDays(parseISO(endDate), days - 1), "yyyy-MM-dd");
  const byDate = dailyMap(dailyRows.filter((r) => r.habitId === habit.id));
  return listDatesInclusive(start, endDate).map((date) => {
    const row = byDate.get(`${habit.id}:${date}`);
    const count = row?.completionCount ?? 0;
    const freezeUsed = row?.freezeUsed ?? false;
    const offDaySkipped = row?.offDaySkipped ?? false;
    return {
      date,
      count,
      target: habit.targetPerDay,
      hit: dayHit(count, habit.targetPerDay, { freezeUsed, offDaySkipped }),
      freezeUsed,
      offDaySkipped,
    };
  });
}

/** Auto-apply freezes for missed habits on a closed calendar day (End Day). */
export async function applyAutoFreezesForDate(
  userId: string,
  date: string,
  timezone: string,
): Promise<void> {
  if (await isOffDayForUser(userId, date)) return;
  if (await isVacationForUser(userId, date)) return;

  const active = await listActiveHabits(userId);
  if (active.length === 0) return;

  const dailyRows = await fetchDailyRows(
    userId,
    active.map((h) => h.id),
    date,
    date,
  );
  const byDate = dailyMap(dailyRows);
  const now = new Date();

  for (const habit of active) {
    const row = byDate.get(`${habit.id}:${date}`);
    const count = row?.completionCount ?? 0;
    if (
      dayHit(count, habit.targetPerDay, {
        freezeUsed: row?.freezeUsed ?? false,
        offDaySkipped: row?.offDaySkipped ?? false,
      })
    )
      continue;

    const streak = await ensureStreakRow(habit.id);
    const grant = applyMonthlyFreezeGrant(streak, date);
    const freezes = grant.freezesAvailable;
    if (freezes <= 0) continue;

    await db
      .insert(habitDaily)
      .values({
        userId,
        habitId: habit.id,
        date,
        completionCount: count,
        freezeUsed: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [habitDaily.userId, habitDaily.habitId, habitDaily.date],
        set: { freezeUsed: true, updatedAt: now },
      });

    await db
      .update(habitStreaks)
      .set({
        freezesAvailable: freezes - 1,
        freezesUsedThisMonth: grant.freezesUsedThisMonth + 1,
        freezeMonthKey: grant.freezeMonthKey,
        updatedAt: now,
      })
      .where(eq(habitStreaks.habitId, habit.id));
  }

  await recomputeAllHabitStreaks(userId, timezone, date);
}

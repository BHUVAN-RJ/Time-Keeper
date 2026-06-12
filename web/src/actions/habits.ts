"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { habitCompletions, habits, habitStreaks } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import {
  applyOffDayHabitSkips,
  buildHeatmapCells,
  ensureStreakRow,
  fetchDailyRows,
  isOffDayForUser,
  listActiveHabits,
  recomputeAllHabitStreaks,
  recomputeHabitStreak,
  upsertHabitDailyCount,
  type HabitDayCell,
  type HabitWithStreak,
} from "@/lib/habits-compute";
import { format, parseISO, subDays } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

function revalidateHabitPaths() {
  revalidatePath("/today");
  revalidatePath("/habits");
  revalidatePath("/tasks");
  revalidatePath("/week");
  revalidatePath("/stats");
}

export type HabitManageRow = {
  habit: typeof habits.$inferSelect;
  streak: typeof habitStreaks.$inferSelect;
  heatmap: HabitDayCell[];
};

export async function listHabitsForManage(): Promise<{
  timezone: string;
  today: string;
  rows: HabitManageRow[];
}> {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const heatStart = format(subDays(parseISO(today), 13), "yyyy-MM-dd");

  const habitRows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)))
    .orderBy(desc(habits.createdAt));

  const activeIds = habitRows.filter((h) => h.active).map((h) => h.id);
  if (activeIds.length > 0) {
    await recomputeAllHabitStreaks(userId, timezone, today);
  }

  const dailyRows = await fetchDailyRows(
    userId,
    habitRows.map((h) => h.id),
    heatStart,
    today,
  );

  const rows: HabitManageRow[] = [];
  for (const habit of habitRows) {
    const streak = await ensureStreakRow(habit.id);
    rows.push({
      habit,
      streak,
      heatmap: buildHeatmapCells(habit, dailyRows, today, 14),
    });
  }

  return { timezone, today, rows };
}

export async function getTodayHabits(): Promise<{
  today: string;
  habits: HabitWithStreak[];
  todayIsOffDay: boolean;
}> {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const active = await listActiveHabits(userId);
  if (active.length === 0) return { today, habits: [], todayIsOffDay: false };

  const todayIsOffDay = await isOffDayForUser(userId, today);
  if (todayIsOffDay) {
    await applyOffDayHabitSkips(userId, today, timezone);
  }

  const dailyRows = await fetchDailyRows(
    userId,
    active.map((h) => h.id),
    today,
    today,
  );
  const dailyByHabit = new Map(dailyRows.map((r) => [r.habitId, r]));

  const out: HabitWithStreak[] = [];
  for (const habit of active) {
    const streak = await ensureStreakRow(habit.id);
    const row = dailyByHabit.get(habit.id);
    const todayCount = row?.completionCount ?? 0;
    const offDayPaused = !!row?.offDaySkipped;
    const todayHit =
      offDayPaused ||
      todayCount >= habit.targetPerDay ||
      !!row?.freezeUsed;
    out.push({
      ...habit,
      streak,
      todayCount,
      todayHit,
      offDayPaused,
    });
  }
  return { today, habits: out, todayIsOffDay };
}

export async function createHabitAction(input: {
  name: string;
  description?: string;
  targetPerDay: number;
  categoryId?: string | null;
}) {
  const { userId, timezone } = await requireUser();
  const target = Math.max(1, Math.min(99, Math.floor(input.targetPerDay) || 1));
  const [row] = await db
    .insert(habits)
    .values({
      userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      targetPerDay: target,
      categoryId: input.categoryId || null,
      active: true,
    })
    .returning();
  await ensureStreakRow(row!.id);
  await recomputeHabitStreak(userId, row!, calendarDayInTz(new Date(), timezone));
  revalidateHabitPaths();
  return { id: row!.id };
}

export async function updateHabitAction(
  id: string,
  input: {
    name: string;
    description?: string;
    targetPerDay: number;
    categoryId?: string | null;
    active: boolean;
  },
) {
  const { userId, timezone } = await requireUser();
  const [cur] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .limit(1);
  if (!cur) throw new Error("Habit not found");

  const target = Math.max(1, Math.min(99, Math.floor(input.targetPerDay) || 1));
  const [updated] = await db
    .update(habits)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      targetPerDay: target,
      categoryId: input.categoryId || null,
      active: input.active,
    })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning();
  await recomputeHabitStreak(
    userId,
    updated!,
    calendarDayInTz(new Date(), timezone),
  );
  revalidateHabitPaths();
}

export async function archiveHabitAction(id: string) {
  const { userId } = await requireUser();
  await db
    .update(habits)
    .set({ active: false, archivedAt: new Date() })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));
  revalidateHabitPaths();
}

async function addHabitCountForToday(
  userId: string,
  timezone: string,
  habitId: string,
  addCount: number,
) {
  const today = calendarDayInTz(new Date(), timezone);
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .limit(1);
  if (!habit || !habit.active || habit.archivedAt) {
    throw new Error("Habit not found");
  }

  if (await isOffDayForUser(userId, today)) {
    throw new Error("Habits are paused on off days");
  }

  const now = new Date();
  await db.insert(habitCompletions).values({
    userId,
    habitId,
    completedAt: now,
    count: addCount,
  });

  const dailyRows = await fetchDailyRows(userId, [habitId], today, today);
  const prev = dailyRows[0]?.completionCount ?? 0;
  await upsertHabitDailyCount(userId, habitId, today, prev + addCount);
  await recomputeHabitStreak(userId, habit, today);
}

export async function incrementHabitTodayAction(habitId: string): Promise<{
  todayCount: number;
  todayHit: boolean;
  daysHitLast30: number;
  currentStreak: number;
}> {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .limit(1);
  if (!habit) throw new Error("Habit not found");

  await addHabitCountForToday(userId, timezone, habitId, 1);
  const streak = await ensureStreakRow(habit.id);
  const dailyRows = await fetchDailyRows(userId, [habitId], today, today);
  const todayCount = dailyRows[0]?.completionCount ?? 0;
  const todayHit =
    todayCount >= habit.targetPerDay || !!dailyRows[0]?.freezeUsed;

  revalidatePath("/habits");
  revalidatePath("/tasks");
  revalidatePath("/week");

  return {
    todayCount,
    todayHit,
    daysHitLast30: streak.daysHitLast30,
    currentStreak: streak.currentStreak,
  };
}

export async function completeHabitTodayAction(habitId: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .limit(1);
  if (!habit) throw new Error("Habit not found");

  const dailyRows = await fetchDailyRows(userId, [habitId], today, today);
  const prev = dailyRows[0]?.completionCount ?? 0;
  const need = Math.max(0, habit.targetPerDay - prev);
  if (need <= 0) return;
  await addHabitCountForToday(userId, timezone, habitId, need);
  revalidateHabitPaths();
}

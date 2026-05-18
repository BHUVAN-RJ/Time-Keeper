"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { dayStatus } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { applyVacationHabitSkips, clearVacationHabitSkips } from "@/lib/habits-compute";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

function datesInclusive(start: string, end: string): string[] {
  if (end < start) throw new Error("End date must be on or after start date");
  const n = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  if (n > 90) throw new Error("Vacation range cannot exceed 90 days");
  return Array.from({ length: n }, (_, i) =>
    format(addDays(parseISO(start), i), "yyyy-MM-dd"),
  );
}

function revalidateVacationPaths(userId: string) {
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/stats");
  revalidatePath("/month");
  revalidatePath("/habits");
  revalidatePath("/settings");
  updateTag(`week-${userId}`);
}

export async function getVacationSettings() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const horizon = format(addDays(parseISO(today), 120), "yyyy-MM-dd");

  const rows = await db
    .select({ date: dayStatus.date })
    .from(dayStatus)
    .where(
      and(
        eq(dayStatus.userId, userId),
        eq(dayStatus.isVacation, true),
        gte(dayStatus.date, today),
        lte(dayStatus.date, horizon),
      ),
    )
    .orderBy(dayStatus.date);

  return {
    today,
    upcomingVacationDates: rows.map((r) => r.date),
  };
}

export async function applyVacationRangeAction(startDate: string, endDate: string) {
  const { userId, timezone } = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Invalid date");
  }
  const dates = datesInclusive(startDate, endDate);
  const now = new Date();

  for (const date of dates) {
    await db
      .insert(dayStatus)
      .values({
        userId,
        date,
        isVacation: true,
        isOffDay: false,
        isRed: false,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [dayStatus.userId, dayStatus.date],
        set: {
          isVacation: true,
          isOffDay: false,
          isRed: false,
          updatedAt: now,
        },
      });
    await applyVacationHabitSkips(userId, date, timezone);
  }

  revalidateVacationPaths(userId);
  return { ok: true as const, days: dates.length };
}

export async function clearVacationRangeAction(startDate: string, endDate: string) {
  const { userId, timezone } = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Invalid date");
  }
  const dates = datesInclusive(startDate, endDate);
  const now = new Date();

  for (const date of dates) {
    await db
      .update(dayStatus)
      .set({ isVacation: false, updatedAt: now })
      .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, date)));
    await clearVacationHabitSkips(userId, date, timezone);
  }

  revalidateVacationPaths(userId);
  return { ok: true as const, days: dates.length };
}

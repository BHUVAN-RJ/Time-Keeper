import { and, count, eq, isNull, or, lte, gte } from "drizzle-orm";
import { db } from "@/db";
import { categories, scheduleGoals } from "@/db/schema";
import { calendarDayInTz } from "@/lib/calendar-day";
import { DEFAULT_SCHEDULE_GOALS } from "@/lib/default-schedule-goals";

export async function ensureDefaultScheduleGoals(
  userId: string,
  timezone: string,
): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(scheduleGoals)
    .where(eq(scheduleGoals.userId, userId));
  if ((row?.n ?? 0) > 0) return;

  const today = calendarDayInTz(new Date(), timezone);
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const values = cats
    .map((c) => {
      const target = DEFAULT_SCHEDULE_GOALS[c.name];
      if (target == null || target <= 0) return null;
      return {
        userId,
        categoryId: c.id,
        targetMinutesPerDay: target,
        effectiveFrom: today,
        effectiveTo: null as string | null,
      };
    })
    .filter(Boolean) as {
    userId: string;
    categoryId: string;
    targetMinutesPerDay: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  }[];

  if (values.length > 0) {
    await db.insert(scheduleGoals).values(values);
  }
}

/** Active goals for a calendar day (YYYY-MM-DD). */
export async function goalsForDay(userId: string, date: string) {
  return db
    .select({
      goal: scheduleGoals,
      category: categories,
    })
    .from(scheduleGoals)
    .innerJoin(categories, eq(scheduleGoals.categoryId, categories.id))
    .where(
      and(
        eq(scheduleGoals.userId, userId),
        lte(scheduleGoals.effectiveFrom, date),
        or(
          isNull(scheduleGoals.effectiveTo),
          gte(scheduleGoals.effectiveTo, date),
        ),
      ),
    );
}

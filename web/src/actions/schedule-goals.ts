"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, scheduleGoals } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { goalsForDay } from "@/lib/ensure-schedule-goals";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export async function getScheduleGoalsForToday() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const rows = await goalsForDay(userId, today);
  return rows.map((r) => ({
    id: r.goal.id,
    categoryId: r.category.id,
    categoryName: r.category.name,
    color: r.category.color,
    targetMinutesPerDay: r.goal.targetMinutesPerDay,
  }));
}

export async function upsertScheduleGoalAction(input: {
  categoryId: string;
  targetMinutesPerDay: number;
}) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const target = Math.max(0, Math.round(input.targetMinutesPerDay));

  const [cat] = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.id, input.categoryId), eq(categories.userId, userId)),
    )
    .limit(1);
  if (!cat) throw new Error("Category not found");

  const existing = await goalsForDay(userId, today);
  const match = existing.find((r) => r.category.id === input.categoryId);
  if (match) {
    await db
      .update(scheduleGoals)
      .set({ targetMinutesPerDay: target })
      .where(eq(scheduleGoals.id, match.goal.id));
  } else {
    await db.insert(scheduleGoals).values({
      userId,
      categoryId: input.categoryId,
      targetMinutesPerDay: target,
      effectiveFrom: today,
      effectiveTo: null,
    });
  }

  revalidatePath("/categories");
  revalidatePath("/today");
  revalidatePath("/week");
}

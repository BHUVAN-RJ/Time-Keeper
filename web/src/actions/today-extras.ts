"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, dayStatus, tasks } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { compareTasksForToday, type TaskLike } from "@/lib/task-utils";

const ACTIVE = ["backlog", "scheduled", "in_progress"] as const;

export type TodayTaskRow = typeof tasks.$inferSelect & {
  categoryName: string | null;
  categoryColor: string | null;
};

export async function getTodayDashboardExtras() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  const today = calendarDayInTz(new Date(), timezone);

  const [statusRow] = await db
    .select()
    .from(dayStatus)
    .where(and(eq(dayStatus.userId, id), eq(dayStatus.date, today)))
    .limit(1);

  const rows = await db
    .select({
      task: tasks,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(
      and(
        eq(tasks.userId, id),
        inArray(tasks.status, [...ACTIVE]),
        or(
          eq(tasks.scheduledDate, today),
          eq(tasks.dueDate, today),
          eq(tasks.status, "in_progress"),
        ),
      ),
    );

  const todayTasks: TodayTaskRow[] = rows
    .map((r) => ({
      ...r.task,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
    }))
    .sort((a, b) => compareTasksForToday(a as TaskLike, b as TaskLike));

  const whatsNext = todayTasks[0] ?? null;

  return {
    today,
    todayTasks,
    whatsNext,
    dayEnded: !!statusRow?.endedAt,
    isOffDay: !!statusRow?.isOffDay,
  };
}

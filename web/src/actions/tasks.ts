"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, tasks } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";

export type TaskRow = typeof tasks.$inferSelect & {
  categoryName: string | null;
  categoryColor: string | null;
};

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id);
  return { userId: id, timezone };
}

const ACTIVE_STATUSES = ["backlog", "scheduled", "in_progress"] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

async function taskRowsForUser(userId: string): Promise<TaskRow[]> {
  const rows = await db
    .select({
      task: tasks,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(
      and(eq(tasks.userId, userId), inArray(tasks.status, [...ACTIVE_STATUSES])),
    )
    .orderBy(desc(tasks.updatedAt));

  return rows.map((r) => ({
    ...r.task,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
  }));
}

export async function getTasksPageData(): Promise<{
  timezone: string;
  today: string;
  todayTasks: TaskRow[];
  backlogTasks: TaskRow[];
  categories: { id: string; name: string; color: string }[];
}> {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const all = await taskRowsForUser(userId);

  const todayTasks = all.filter(
    (t) =>
      ACTIVE_STATUSES.includes(t.status as ActiveStatus) &&
      (t.scheduledDate === today ||
        t.dueDate === today ||
        t.status === "in_progress"),
  );

  const backlogTasks = all.filter(
    (t) =>
      t.status === "backlog" ||
      (t.status === "scheduled" &&
        t.scheduledDate !== today &&
        t.dueDate !== today),
  );

  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.archived, false)));

  return { timezone, today, todayTasks, backlogTasks, categories: cats };
}

export async function createTaskAction(input: {
  title: string;
  estimateMinutes: number;
  categoryId?: string | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  urgency?: number;
  importance?: number;
  description?: string | null;
}) {
  const { userId } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const estimateMinutes = Math.round(input.estimateMinutes);
  if (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0) {
    throw new Error("Estimate must be a positive number of minutes");
  }

  const status =
    input.scheduledDate || input.dueDate ? "scheduled" : "backlog";

  await db.insert(tasks).values({
    userId,
    title,
    description: input.description?.trim() || null,
    categoryId: input.categoryId || null,
    estimateMinutes,
    dueDate: input.dueDate || null,
    scheduledDate: input.scheduledDate || null,
    urgency: clamp14(input.urgency ?? 3),
    importance: clamp14(input.importance ?? 3),
    status,
  });

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function completeTaskAction(taskId: string) {
  const { userId } = await requireUser();
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Task not found");
  if (row.status === "completed" || row.status === "dropped") return;

  await db
    .update(tasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function dropTaskAction(taskId: string, reason: string) {
  const { userId } = await requireUser();
  const dropReason = reason.trim();
  if (!dropReason) throw new Error("Drop reason is required");

  await db
    .update(tasks)
    .set({
      status: "dropped",
      droppedAt: new Date(),
      dropReason,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function scheduleTaskForTodayAction(taskId: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);

  await db
    .update(tasks)
    .set({
      scheduledDate: today,
      status: "scheduled",
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
}

function clamp14(n: number) {
  return Math.min(4, Math.max(1, Math.round(n)));
}

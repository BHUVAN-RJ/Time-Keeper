import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { tasks, timeBlocks } from "@/db/schema";
import { blockDurationMinutes } from "@/lib/block-minutes";

export type TaskLike = {
  urgency: number;
  importance: number;
  dueDate: string | null;
  sortOrder: number;
};

export function eisenhowerQuadrant(urgency: number, importance: number) {
  if (urgency <= 2 && importance <= 2) return 1;
  if (urgency > 2 && importance <= 2) return 2;
  if (urgency <= 2 && importance > 2) return 3;
  return 4;
}

export function compareTasksForToday(a: TaskLike, b: TaskLike) {
  const qa = eisenhowerQuadrant(a.urgency, a.importance);
  const qb = eisenhowerQuadrant(b.urgency, b.importance);
  if (qa !== qb) return qa - qb;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.sortOrder - b.sortOrder;
}

export async function syncTaskActualMinutes(taskId: string, userId: string) {
  const rows = await db
    .select()
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.taskId, taskId),
        eq(timeBlocks.userId, userId),
        isNotNull(timeBlocks.endAt),
      ),
    );

  let total = 0;
  for (const b of rows) {
    total += blockDurationMinutes(
      new Date(b.startAt),
      new Date(b.endAt!),
    );
  }

  await db
    .update(tasks)
    .set({ actualMinutes: total, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  return total;
}

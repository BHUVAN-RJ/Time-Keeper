import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { tasks, timeBlocks } from "@/db/schema";
import { blockDurationMinutes } from "@/lib/block-minutes";

export type { TaskPriorityLike as TaskLike } from "@/lib/eisenhower";
export {
  compareTasksForToday,
  compareTasksInQuadrant,
  eisenhowerQuadrant,
} from "@/lib/eisenhower";

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

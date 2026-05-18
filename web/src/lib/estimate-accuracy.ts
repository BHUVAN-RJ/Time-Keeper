import { db } from "@/db";
import { tasks } from "@/db/schema";
import { and, count, eq, gt } from "drizzle-orm";

const MIN_COMPLETED_FOR_HINT = 10;

export async function estimateAccuracyMultiplier(
  userId: string,
): Promise<{ ready: boolean; multiplier: number; completedCount: number }> {
  const [row] = await db
    .select({ n: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "completed"),
        gt(tasks.actualMinutes, 0),
        gt(tasks.estimateMinutes, 0),
      ),
    );

  const completedCount = row?.n ?? 0;
  if (completedCount < MIN_COMPLETED_FOR_HINT) {
    return { ready: false, multiplier: 1, completedCount };
  }

  const completed = await db
    .select({
      estimateMinutes: tasks.estimateMinutes,
      actualMinutes: tasks.actualMinutes,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "completed"),
        gt(tasks.actualMinutes, 0),
        gt(tasks.estimateMinutes, 0),
      ),
    )
    .limit(200);

  if (completed.length === 0) {
    return { ready: false, multiplier: 1, completedCount };
  }

  let ratioSum = 0;
  for (const t of completed) {
    ratioSum += t.actualMinutes / t.estimateMinutes;
  }
  const multiplier = ratioSum / completed.length;
  return { ready: true, multiplier, completedCount };
}

export function adjustedEstimateMinutes(
  estimateMinutes: number,
  multiplier: number,
): number {
  return Math.max(1, Math.round(estimateMinutes * multiplier));
}

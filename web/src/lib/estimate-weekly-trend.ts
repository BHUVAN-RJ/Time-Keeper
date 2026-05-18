import { db } from "@/db";
import { tasks } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { addDays, format, parseISO } from "date-fns";

export type EstimateWeekPoint = {
  weekStarting: string;
  label: string;
  ratio: number | null;
  completedCount: number;
};

/** Actual/estimate ratio per ISO week for the last `weekCount` weeks ending at `anchorWeekStart`. */
export async function estimateAccuracyByWeek(
  userId: string,
  anchorWeekStart: string,
  weekCount = 4,
): Promise<EstimateWeekPoint[]> {
  const points: EstimateWeekPoint[] = [];

  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = format(
      addDays(parseISO(anchorWeekStart), -7 * i),
      "yyyy-MM-dd",
    );
    const weekEndExclusive = format(
      addDays(parseISO(weekStart), 7),
      "yyyy-MM-dd",
    );
    const label = format(parseISO(weekStart), "MMM d");

    const rows = await db
      .select({
        estimateMinutes: tasks.estimateMinutes,
        actualMinutes: tasks.actualMinutes,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "completed"),
          gte(tasks.completedAt, parseISO(weekStart)),
          lt(tasks.completedAt, parseISO(weekEndExclusive)),
          gte(tasks.actualMinutes, 1),
          gte(tasks.estimateMinutes, 1),
        ),
      );

    let estSum = 0;
    let actSum = 0;
    for (const t of rows) {
      estSum += t.estimateMinutes;
      actSum += t.actualMinutes;
    }

    points.push({
      weekStarting: weekStart,
      label,
      ratio: estSum > 0 ? Math.round((actSum / estSum) * 100) / 100 : null,
      completedCount: rows.length,
    });
  }

  return points;
}

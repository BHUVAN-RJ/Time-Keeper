import type { CategoryGoalRow } from "@/lib/day-compute";

export type WeekCategoryGoalRow = CategoryGoalRow;

/** Sum per-category actual vs daily targets across closed days in the week. */
export function aggregateWeekCategoryGoals(
  days: { endedAt: Date | null; categoryGoals: CategoryGoalRow[] }[],
): WeekCategoryGoalRow[] {
  const byId = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      color: string;
      targetMinutes: number;
      actualMinutes: number;
    }
  >();

  for (const day of days) {
    if (!day.endedAt) continue;
    for (const g of day.categoryGoals) {
      const cur = byId.get(g.categoryId) ?? {
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        color: g.color,
        targetMinutes: 0,
        actualMinutes: 0,
      };
      cur.targetMinutes += g.targetMinutes;
      cur.actualMinutes += g.actualMinutes;
      byId.set(g.categoryId, cur);
    }
  }

  return [...byId.values()]
    .map((g) => ({
      ...g,
      hitPercent:
        g.targetMinutes > 0
          ? Math.min(100, Math.round((g.actualMinutes / g.targetMinutes) * 100))
          : g.actualMinutes > 0
            ? 100
            : 0,
    }))
    .filter((g) => g.targetMinutes > 0 || g.actualMinutes > 0)
    .sort((a, b) => b.actualMinutes - a.actualMinutes);
}

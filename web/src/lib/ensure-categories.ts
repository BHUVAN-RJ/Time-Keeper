import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, timeBlocks } from "@/db/schema";
import { DEFAULT_CATEGORIES } from "./default-categories";
import { ensureDefaultScheduleGoals } from "./ensure-schedule-goals";

export async function ensureDefaultCategories(
  userId: string,
  timezone = "America/Los_Angeles",
): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(categories)
    .where(eq(categories.userId, userId));

  if ((row?.n ?? 0) > 0) {
    await ensureDefaultScheduleGoals(userId, timezone);
    return;
  }

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c) => ({
      userId,
      name: c.name,
      baseCreditRate: c.baseCreditRate,
      color: c.color,
      isFreeTime: c.isFreeTime,
      archived: false,
    })),
  );
  await ensureDefaultScheduleGoals(userId, timezone);
}

export async function categoryBlockCount(
  userId: string,
  categoryId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(timeBlocks)
    .where(
      and(eq(timeBlocks.userId, userId), eq(timeBlocks.categoryId, categoryId)),
    );
  return row?.n ?? 0;
}

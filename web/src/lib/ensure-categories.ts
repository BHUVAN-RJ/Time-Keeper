import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, timeBlocks } from "@/db/schema";
import {
  CHORES_CATEGORY_NAME,
  DEFAULT_CATEGORIES,
} from "./default-categories";
import { ensureDefaultScheduleGoals } from "./ensure-schedule-goals";

async function migrateLegacyChoresQuality(
  userId: string,
  choresCategoryId: string,
): Promise<void> {
  await db
    .update(timeBlocks)
    .set({ categoryId: choresCategoryId, quality: "meh" })
    .where(
      and(eq(timeBlocks.userId, userId), eq(timeBlocks.quality, "chores")),
    );
}

export async function ensureDefaultCategories(
  userId: string,
  timezone = "America/Los_Angeles",
): Promise<void> {
  const existing = await db
    .select({ name: categories.name, id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId));

  if (existing.length === 0) {
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
    return;
  }

  const existingNames = new Set(existing.map((c) => c.name));
  const missing = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name));
  if (missing.length > 0) {
    await db.insert(categories).values(
      missing.map((c) => ({
        userId,
        name: c.name,
        baseCreditRate: c.baseCreditRate,
        color: c.color,
        isFreeTime: c.isFreeTime,
        archived: false,
      })),
    );
  }

  const choresCategory = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.name, CHORES_CATEGORY_NAME)),
    )
    .limit(1);

  if (choresCategory[0]) {
    await migrateLegacyChoresQuality(userId, choresCategory[0].id);
  }

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

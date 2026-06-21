import { and, count, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, timeBlocks } from "@/db/schema";
import {
  APPROVED_CATEGORY_NAMES,
  COOKING_CLEANING_CATEGORY_NAME,
  DEFAULT_CATEGORIES,
  LEGACY_CHORES_NAME,
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

async function archiveNonApprovedCategories(userId: string): Promise<void> {
  await db
    .update(categories)
    .set({ archived: true })
    .where(
      and(
        eq(categories.userId, userId),
        notInArray(categories.name, [...APPROVED_CATEGORY_NAMES]),
      ),
    );

  await db
    .update(categories)
    .set({ archived: false })
    .where(
      and(
        eq(categories.userId, userId),
        inArray(categories.name, [...APPROVED_CATEGORY_NAMES]),
      ),
    );
}

async function renameLegacyChores(userId: string): Promise<void> {
  const legacy = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.name, LEGACY_CHORES_NAME)),
    )
    .limit(1);
  if (!legacy[0]) return;

  const existingNew = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.name, COOKING_CLEANING_CATEGORY_NAME),
      ),
    )
    .limit(1);
  if (existingNew[0] && existingNew[0].id !== legacy[0].id) {
    await db
      .update(timeBlocks)
      .set({ categoryId: existingNew[0].id })
      .where(
        and(
          eq(timeBlocks.userId, userId),
          eq(timeBlocks.categoryId, legacy[0].id),
        ),
      );
    await db
      .update(categories)
      .set({ archived: true })
      .where(eq(categories.id, legacy[0].id));
    return;
  }

  await db
    .update(categories)
    .set({ name: COOKING_CLEANING_CATEGORY_NAME, archived: false })
    .where(eq(categories.id, legacy[0].id));
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

  await renameLegacyChores(userId);
  await archiveNonApprovedCategories(userId);

  const cookingCategory = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.name, COOKING_CLEANING_CATEGORY_NAME),
      ),
    )
    .limit(1);

  if (cookingCategory[0]) {
    await migrateLegacyChoresQuality(userId, cookingCategory[0].id);
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

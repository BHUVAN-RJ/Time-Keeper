import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, shopRedemptions, timeBlocks } from "@/db/schema";
import { allocationCreditMultiplier } from "@/lib/allocation-bonus";
import { normalizeQuality, qualityCreditMultiplier } from "@/lib/quality";

type BlockCreditRow = {
  block: typeof timeBlocks.$inferSelect;
  category: typeof categories.$inferSelect;
};

export function creditsFromBlockRows(rows: BlockCreditRow[]): {
  earned: number;
  spent: number;
} {
  let earned = 0;
  let spent = 0;
  for (const { block, category } of rows) {
    if (!block.endAt || !block.quality) continue;
    const q = normalizeQuality(block.quality);
    if (!q) continue;
    const mins =
      (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) /
      60_000;
    if (mins <= 0) continue;
    const hours = mins / 60;
    let raw =
      hours *
      category.baseCreditRate *
      qualityCreditMultiplier(q) *
      allocationCreditMultiplier(block);
    if (block.randomBonusApplied) raw *= 1.5;
    if (category.isFreeTime) spent += raw;
    else earned += raw;
  }
  return { earned, spent };
}

export async function sumRedemptionPoints(userId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${shopRedemptions.pointsSpent}), 0)`,
    })
    .from(shopRedemptions)
    .where(eq(shopRedemptions.userId, userId));
  return row?.total ?? 0;
}

export async function computeCreditBalance(userId: string): Promise<number> {
  const rows = await db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(eq(timeBlocks.userId, userId));
  const { earned, spent } = creditsFromBlockRows(rows);
  const redeemed = await sumRedemptionPoints(userId);
  return earned - spent - redeemed;
}

export async function computeCreditsEarned(userId: string): Promise<number> {
  const rows = await db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(eq(timeBlocks.userId, userId));
  return creditsFromBlockRows(rows).earned;
}

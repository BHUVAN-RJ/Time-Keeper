"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, shopRedemptions } from "@/db/schema";
import { computeCreditBalance } from "@/lib/credit-balance";
import { ensureShopCatalog } from "@/lib/seed-shop";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

export async function getShopPageData() {
  const userId = await requireUser();
  await ensureShopCatalog();

  const balance = await computeCreditBalance(userId);
  const items = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.active, true))
    .orderBy(shopItems.sortOrder);

  const redemptions = await db
    .select({
      id: shopRedemptions.id,
      pointsSpent: shopRedemptions.pointsSpent,
      redeemedAt: shopRedemptions.redeemedAt,
      itemName: shopItems.name,
    })
    .from(shopRedemptions)
    .innerJoin(shopItems, eq(shopRedemptions.shopItemId, shopItems.id))
    .where(eq(shopRedemptions.userId, userId))
    .orderBy(desc(shopRedemptions.redeemedAt))
    .limit(50);

  return {
    balance,
    items: items.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      costPoints: item.costPoints,
      canAfford: balance >= item.costPoints,
    })),
    redemptions: redemptions.map((r) => ({
      id: r.id,
      itemName: r.itemName,
      pointsSpent: r.pointsSpent,
      redeemedAt: new Date(r.redeemedAt).toISOString(),
    })),
  };
}

export type ShopPageData = Awaited<ReturnType<typeof getShopPageData>>;

export async function redeemShopItemAction(itemId: string): Promise<
  | { ok: true; balanceAfter: number; itemName: string; pointsSpent: number }
  | { ok: false; error: "INSUFFICIENT_BALANCE" | "ITEM_NOT_FOUND" | "UNAUTHORIZED" }
> {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  await ensureShopCatalog();

  const [item] = await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.id, itemId), eq(shopItems.active, true)))
    .limit(1);
  if (!item) return { ok: false, error: "ITEM_NOT_FOUND" };

  const balance = await computeCreditBalance(userId);
  if (balance < item.costPoints) {
    return { ok: false, error: "INSUFFICIENT_BALANCE" };
  }

  await db.insert(shopRedemptions).values({
    userId,
    shopItemId: item.id,
    pointsSpent: item.costPoints,
    redeemedAt: new Date(),
  });

  const balanceAfter = await computeCreditBalance(userId);
  revalidatePath("/shop");
  revalidatePath("/stats");

  return {
    ok: true,
    balanceAfter,
    itemName: item.name,
    pointsSpent: item.costPoints,
  };
}

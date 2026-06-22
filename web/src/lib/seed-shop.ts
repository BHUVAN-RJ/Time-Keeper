import { db } from "@/db";
import { shopItems } from "@/db/schema";
import { eq } from "drizzle-orm";

const CATALOG = [
  {
    slug: "food-coupon",
    name: "Food Coupon",
    description: "Treat yourself — symbolic weekly reward",
    costPoints: 850,
    sortOrder: 1,
  },
  {
    slug: "ps5",
    name: "PlayStation 5",
    description: "Big goal reward — symbolic redemption",
    costPoints: 16500,
    sortOrder: 2,
  },
] as const;

export async function ensureShopCatalog(): Promise<void> {
  for (const item of CATALOG) {
    const [existing] = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, item.slug))
      .limit(1);
    if (existing) continue;
    await db.insert(shopItems).values({
      slug: item.slug,
      name: item.name,
      description: item.description,
      costPoints: item.costPoints,
      active: true,
      sortOrder: item.sortOrder,
      createdAt: new Date(),
    });
  }
}

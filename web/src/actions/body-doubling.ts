"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, timeBlocks, userPreferences } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
export async function getBodyDoublingPingState() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { intervalMinutes: 0 as const, running: null };

  const [pref] = await db
    .select({ minutes: userPreferences.bodyDoublingIntervalMinutes })
    .from(userPreferences)
    .where(eq(userPreferences.userId, id))
    .limit(1);

  const intervalMinutes = pref?.minutes ?? 0;
  if (intervalMinutes <= 0) {
    return { intervalMinutes: 0 as const, running: null };
  }

  const [row] = await db
    .select({
      id: timeBlocks.id,
      startAt: timeBlocks.startAt,
      statedIntent: timeBlocks.statedIntent,
      categoryName: categories.name,
    })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(and(eq(timeBlocks.userId, id), isNull(timeBlocks.endAt)))
    .limit(1);

  if (!row?.statedIntent?.trim()) {
    return { intervalMinutes, running: null };
  }

  return {
    intervalMinutes,
    running: {
      blockId: row.id,
      startedAt: new Date(row.startAt).toISOString(),
      statedIntent: row.statedIntent.trim(),
      categoryName: row.categoryName,
    },
  };
}

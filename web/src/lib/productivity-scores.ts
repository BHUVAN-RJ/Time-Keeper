import { db } from "@/db";
import { productivityScores } from "@/db/schema";
import type { DaySnapshot } from "@/lib/day-compute";

export async function persistProductivityScore(
  userId: string,
  snap: DaySnapshot,
  vsRollingAvg: number | null,
) {
  const now = new Date();
  await db
    .insert(productivityScores)
    .values({
      userId,
      date: snap.date,
      score: snap.productivityScore,
      breakdownJson: JSON.stringify(snap.scoreBreakdown),
      vsRollingAvg,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [productivityScores.userId, productivityScores.date],
      set: {
        score: snap.productivityScore,
        breakdownJson: JSON.stringify(snap.scoreBreakdown),
        vsRollingAvg,
        updatedAt: now,
      },
    });
}

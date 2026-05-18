import { db } from "@/db";
import { dayStatus, offDayBalance, offDayUses } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export const OFF_DAY_CAP = 5;
export const OFF_DAY_ACCRUAL_EVERY = 6;
export const OFF_DAY_NUDGE_AT = 4;

export async function getOffDayBalance(userId: string) {
  const [row] = await db
    .select()
    .from(offDayBalance)
    .where(eq(offDayBalance.userId, userId))
    .limit(1);
  if (row) return row;
  const now = new Date();
  await db.insert(offDayBalance).values({
    userId,
    available: 0,
    lifetimeForfeited: 0,
    updatedAt: now,
  });
  return {
    userId,
    available: 0,
    lifetimeForfeited: 0,
    lastRecalcDate: null,
    updatedAt: now,
  };
}

/** Engaged day: ended_at set OR goal_hit_percent >= 50 (not off/vacation). */
async function countEngagedDaysSince(
  userId: string,
  sinceDate: string,
): Promise<number> {
  const rows = await db
    .select({
      endedAt: dayStatus.endedAt,
      goalHitPercent: dayStatus.goalHitPercent,
      isOffDay: dayStatus.isOffDay,
      isVacation: dayStatus.isVacation,
    })
    .from(dayStatus)
    .where(
      and(
        eq(dayStatus.userId, userId),
        gt(dayStatus.date, sinceDate),
      ),
    );

  return rows.filter(
    (r) =>
      !r.isOffDay &&
      !r.isVacation &&
      (r.endedAt != null || (r.goalHitPercent ?? 0) >= 50),
  ).length;
}

export async function accrueOffDaysOnEndDay(userId: string, closeDate: string) {
  const bal = await getOffDayBalance(userId);
  const since =
    bal.lastRecalcDate ??
    "1970-01-01";
  let engaged = await countEngagedDaysSince(userId, since);
  if (!bal.lastRecalcDate) {
    engaged = Math.min(engaged, OFF_DAY_ACCRUAL_EVERY * 2);
  }
  if (engaged < OFF_DAY_ACCRUAL_EVERY) {
    await db
      .update(offDayBalance)
      .set({ lastRecalcDate: closeDate, updatedAt: new Date() })
      .where(eq(offDayBalance.userId, userId));
    return { accrued: 0, forfeited: 0, available: bal.available };
  }

  const grants = Math.floor(engaged / OFF_DAY_ACCRUAL_EVERY);
  let available = bal.available;
  let forfeited = bal.lifetimeForfeited;
  let added = 0;
  let lost = 0;
  for (let i = 0; i < grants; i++) {
    if (available < OFF_DAY_CAP) {
      available += 1;
      added += 1;
    } else {
      lost += 1;
      forfeited += 1;
    }
  }

  await db
    .update(offDayBalance)
    .set({
      available,
      lifetimeForfeited: forfeited,
      lastRecalcDate: closeDate,
      updatedAt: new Date(),
    })
    .where(eq(offDayBalance.userId, userId));

  return { accrued: added, forfeited: lost, available };
}

export async function spendOffDay(
  userId: string,
  date: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bal = await getOffDayBalance(userId);
  if (bal.available < 1) {
    return { ok: false, error: "No off days in your bank. Earn one every 6 engaged days." };
  }

  const now = new Date();
  await db
    .update(offDayBalance)
    .set({ available: bal.available - 1, updatedAt: now })
    .where(eq(offDayBalance.userId, userId));

  await db
    .insert(offDayUses)
    .values({
      userId,
      date,
      reason: reason?.trim() || null,
      createdAt: now,
    })
    .onConflictDoNothing();

  return { ok: true };
}

export async function refundOffDay(userId: string, date: string) {
  const [use] = await db
    .select()
    .from(offDayUses)
    .where(and(eq(offDayUses.userId, userId), eq(offDayUses.date, date)))
    .limit(1);
  if (!use) return;

  const bal = await getOffDayBalance(userId);
  await db.delete(offDayUses).where(eq(offDayUses.id, use.id));
  await db
    .update(offDayBalance)
    .set({
      available: Math.min(OFF_DAY_CAP, bal.available + 1),
      updatedAt: new Date(),
    })
    .where(eq(offDayBalance.userId, userId));
}

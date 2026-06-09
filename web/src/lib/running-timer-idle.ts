import { db } from "@/db";
import { timeBlocks, userPreferences } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/** Auto-stop when no timer activity for this long (ms). */
export const TIMER_IDLE_MS = 60 * 60 * 1000;

/** Hard cap on a single continuous run (ms). */
export const TIMER_MAX_RUN_MS = 12 * 60 * 60 * 1000;

export type AutoStopReason = "idle" | "max_duration";

export async function recordTimerActivity(userId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId,
      timerLastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { timerLastSeenAt: now, updatedAt: now },
    });
}

export async function clearTimerActivity(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(userPreferences)
    .set({ timerLastSeenAt: null, updatedAt: now })
    .where(eq(userPreferences.userId, userId));
}

/**
 * Stop a forgotten running block after idle time or max duration.
 * Leaves label empty and sets quality to meh.
 */
export async function autoStopStaleRunningBlock(
  userId: string,
): Promise<{ stopped: boolean; reason?: AutoStopReason }> {
  const now = new Date();
  const [running] = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), isNull(timeBlocks.endAt)))
    .limit(1);

  if (!running) return { stopped: false };

  const start = new Date(running.startAt);
  const [pref] = await db
    .select({ timerLastSeenAt: userPreferences.timerLastSeenAt })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const lastSeen = pref?.timerLastSeenAt
    ? new Date(pref.timerLastSeenAt)
    : start;

  let endAt: Date | null = null;
  let reason: AutoStopReason | undefined;

  const maxEnd = new Date(start.getTime() + TIMER_MAX_RUN_MS);
  if (now.getTime() > maxEnd.getTime()) {
    endAt = maxEnd;
    reason = "max_duration";
  } else if (now.getTime() - lastSeen.getTime() > TIMER_IDLE_MS) {
    endAt = new Date(lastSeen.getTime() + TIMER_IDLE_MS);
    reason = "idle";
  }

  if (!endAt) return { stopped: false };

  if (endAt.getTime() <= start.getTime()) {
    endAt = now;
  }

  await db
    .update(timeBlocks)
    .set({
      endAt,
      label: null,
      quality: "meh",
      updatedAt: now,
    })
    .where(
      and(eq(timeBlocks.id, running.id), eq(timeBlocks.userId, userId), isNull(timeBlocks.endAt)),
    );

  await clearTimerActivity(userId);

  return { stopped: true, reason };
}

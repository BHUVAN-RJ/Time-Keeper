"use server";

import { auth } from "@/auth";
import { computeDaySnapshot } from "@/lib/day-compute";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";

/** Lightweight score read for optional Today widget & task-complete toast. */
export async function getTodayProductivityScore() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  const today = calendarDayInTz(new Date(), timezone);
  const snap = await computeDaySnapshot(id, today, timezone);
  return {
    score: snap.productivityScore,
    hasActivity: snap.hasActivity,
    isRed: snap.isRed,
  };
}

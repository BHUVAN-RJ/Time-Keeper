"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { dayStatus } from "@/db/schema";
import { and, count, eq, gte } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import {
  applyOffDayHabitSkips,
  clearOffDayHabitSkips,
} from "@/lib/habits-compute";
import {
  getOffDayBalance,
  OFF_DAY_NUDGE_AT,
  refundOffDay,
  spendOffDay,
} from "@/lib/off-day-balance";
import { addDays, format, parseISO } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export async function countOffDaysInLast30Days(): Promise<number> {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const since = format(addDays(parseISO(today), -29), "yyyy-MM-dd");

  const [row] = await db
    .select({ n: count() })
    .from(dayStatus)
    .where(
      and(
        eq(dayStatus.userId, userId),
        eq(dayStatus.isOffDay, true),
        gte(dayStatus.date, since),
      ),
    );

  return row?.n ?? 0;
}

export async function markOffDayAction(options?: {
  acknowledgeHeavyUse?: boolean;
}) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const existing = await countOffDaysInLast30Days();

  if (existing >= 3 && !options?.acknowledgeHeavyUse) {
    return {
      ok: false as const,
      needsCheckIn: true,
      offDaysIn30: existing,
    };
  }

  const spend = await spendOffDay(userId, today);
  if (!spend.ok) {
    return { ok: false as const, error: spend.error, needsBank: true };
  }

  const now = new Date();
  await db
    .insert(dayStatus)
    .values({
      userId,
      date: today,
      isOffDay: true,
      isRed: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dayStatus.userId, dayStatus.date],
      set: {
        isOffDay: true,
        isRed: false,
        updatedAt: now,
      },
    });

  await applyOffDayHabitSkips(userId, today, timezone);

  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/stats");
  revalidatePath("/habits");
  updateTag(`week-${userId}`);
  const bal = await getOffDayBalance(userId);
  return {
    ok: true as const,
    offDaysAvailable: bal.available,
    showRestNudge: bal.available >= OFF_DAY_NUDGE_AT,
  };
}

export async function getOffDayBankSummary() {
  const { userId } = await requireUser();
  const bal = await getOffDayBalance(userId);
  return {
    available: bal.available,
    lifetimeForfeited: bal.lifetimeForfeited,
    showRestNudge: bal.available >= OFF_DAY_NUDGE_AT,
  };
}

/** Undo an off-day mark (e.g. from Week tab). */
export async function clearOffDayAction(date: string) {
  const { userId, timezone } = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date");
  }

  const now = new Date();
  await db
    .update(dayStatus)
    .set({ isOffDay: false, updatedAt: now })
    .where(and(eq(dayStatus.userId, userId), eq(dayStatus.date, date)));

  await clearOffDayHabitSkips(userId, date, timezone);
  await refundOffDay(userId, date);

  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/stats");
  revalidatePath("/habits");
  updateTag(`week-${userId}`);
}

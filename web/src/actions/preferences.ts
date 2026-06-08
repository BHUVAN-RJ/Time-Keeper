"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  FREEZE_MINUTES_PER_CREDIT,
  getOverworkBank,
  getOverworkCreditsPercent,
} from "@/lib/overwork";

export async function getOverworkSettings() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const [creditsPercent, bank] = await Promise.all([
    getOverworkCreditsPercent(id),
    getOverworkBank(id),
  ]);
  return {
    creditsPercent,
    unbankedMinutes: bank.unbankedMinutes,
    bankedFreezeCredits: bank.bankedFreezeCredits,
    freezeMinutesPerCredit: FREEZE_MINUTES_PER_CREDIT,
  };
}

export async function getOverworkSplitPercent(): Promise<number> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return 50;
  const [row] = await db
    .select({ pct: userPreferences.overworkCreditsPercent })
    .from(userPreferences)
    .where(eq(userPreferences.userId, id))
    .limit(1);
  return row?.pct ?? 50;
}

export type BodyDoublingInterval = 0 | 30 | 60 | 90;

export async function getBodyDoublingSettings() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const [row] = await db
    .select({
      minutes: userPreferences.bodyDoublingIntervalMinutes,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, id))
    .limit(1);
  const m = row?.minutes ?? 0;
  const interval: BodyDoublingInterval =
    m === 30 || m === 60 || m === 90 ? m : 0;
  return { intervalMinutes: interval };
}

export async function setBodyDoublingInterval(minutes: BodyDoublingInterval) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const allowed: BodyDoublingInterval[] = [0, 30, 60, 90];
  if (!allowed.includes(minutes)) throw new Error("Invalid interval");
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId: id,
      bodyDoublingIntervalMinutes: minutes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { bodyDoublingIntervalMinutes: minutes, updatedAt: now },
    });
  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function getTagsSettings() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return { enabled: await getTagsEnabledForUser(id) };
}

export async function getTagsEnabledForUser(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: string,
): Promise<boolean> {
  // Tags were removed in favor of a single Label dimension (US8). The schema is
  // retained for historical data, but tags no longer surface anywhere.
  return false;
}

export async function getRemindersSettings() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return { enabled: await getRemindersEnabledForUser(id) };
}

export async function getRemindersEnabledForUser(
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: userPreferences.remindersEnabled })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return row?.enabled ?? false;
}

export async function setRemindersEnabled(enabled: boolean) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId: id,
      remindersEnabled: enabled,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { remindersEnabled: enabled, updatedAt: now },
    });
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/week");
}

export async function setTagsEnabled(enabled: boolean) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId: id,
      tagsEnabled: enabled,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { tagsEnabled: enabled, updatedAt: now },
    });
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/month");
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getActiveWindowForUser(
  userId: string,
): Promise<{ start: string; end: string }> {
  const [row] = await db
    .select({
      start: userPreferences.activeWindowStart,
      end: userPreferences.activeWindowEnd,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return { start: row?.start ?? "09:00", end: row?.end ?? "21:00" };
}

export async function getActiveWindowSettings() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return getActiveWindowForUser(id);
}

export async function setActiveWindowAction(
  start: string,
  end: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  if (!HHMM_RE.test(start) || !HHMM_RE.test(end)) {
    return { ok: false, error: "Times must be in HH:MM (24h) format" };
  }
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId: id,
      activeWindowStart: start,
      activeWindowEnd: end,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { activeWindowStart: start, activeWindowEnd: end, updatedAt: now },
    });
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/stats");
  return { ok: true };
}

export async function setOverworkSplitPercent(percent: number) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId: id,
      overworkCreditsPercent: pct,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { overworkCreditsPercent: pct, updatedAt: now },
    });
  revalidatePath("/settings");
}

import { db } from "@/db";
import { overworkBank, userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

export const FREEZE_MINUTES_PER_CREDIT = 480;
export const OVERWORK_SOFT_CAP_RATIO = 1.5;

export async function getOverworkCreditsPercent(userId: string): Promise<number> {
  const [row] = await db
    .select({ pct: userPreferences.overworkCreditsPercent })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const pct = row?.pct ?? 50;
  return Math.min(100, Math.max(0, pct));
}

export async function getOverworkBank(userId: string) {
  const [row] = await db
    .select()
    .from(overworkBank)
    .where(eq(overworkBank.userId, userId))
    .limit(1);
  if (row) return row;
  const now = new Date();
  await db.insert(overworkBank).values({
    userId,
    unbankedMinutes: 0,
    bankedFreezeCredits: 0,
    updatedAt: now,
  });
  return {
    userId,
    unbankedMinutes: 0,
    bankedFreezeCredits: 0,
    updatedAt: now,
  };
}

export function overworkMinutes(workMinutes: number, workGoalMinutes: number) {
  return Math.max(0, workMinutes - workGoalMinutes);
}

export function formatOverworkMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function projectOverworkSplit(
  overworkMins: number,
  creditsPercent: number,
): { toCredits: number; toBank: number } {
  if (overworkMins <= 0) return { toCredits: 0, toBank: 0 };
  const toCredits = Math.round((overworkMins * creditsPercent) / 100);
  return { toCredits, toBank: overworkMins - toCredits };
}

export function overworkPastSoftCap(
  workMinutes: number,
  workGoalMinutes: number,
): boolean {
  if (workGoalMinutes <= 0) return false;
  return workMinutes > workGoalMinutes * OVERWORK_SOFT_CAP_RATIO;
}

export async function applyOverworkForDay(
  userId: string,
  workMinutes: number,
  workGoalMinutes: number,
): Promise<{
  overworkMinutes: number;
  creditBonus: number;
  bankedMinutes: number;
  newFreezeCredits: number;
}> {
  const ow = overworkMinutes(workMinutes, workGoalMinutes);
  if (ow <= 0) {
    return {
      overworkMinutes: 0,
      creditBonus: 0,
      bankedMinutes: 0,
      newFreezeCredits: 0,
    };
  }

  const creditsPct = await getOverworkCreditsPercent(userId);
  const toCredits = Math.round((ow * creditsPct) / 100);
  const toBank = ow - toCredits;

  const bank = await getOverworkBank(userId);
  const totalBanked = bank.unbankedMinutes + toBank;
  const freezeGrants = Math.floor(totalBanked / FREEZE_MINUTES_PER_CREDIT);
  const remainder = totalBanked % FREEZE_MINUTES_PER_CREDIT;

  await db
    .update(overworkBank)
    .set({
      unbankedMinutes: remainder,
      bankedFreezeCredits: bank.bankedFreezeCredits + freezeGrants,
      updatedAt: new Date(),
    })
    .where(eq(overworkBank.userId, userId));

  return {
    overworkMinutes: ow,
    creditBonus: toCredits,
    bankedMinutes: toBank,
    newFreezeCredits: freezeGrants,
  };
}

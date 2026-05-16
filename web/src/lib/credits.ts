import type { Quality } from "@/lib/quality";
import { normalizeQuality, qualityCreditMultiplier } from "@/lib/quality";

export type { Quality } from "@/lib/quality";

/** Credits for one stopped block (minutes-equivalent per spec §6.2). */
export function blockCreditsMinutes(params: {
  startAt: Date;
  endAt: Date;
  baseCreditRatePerHour: number;
  quality: Quality | string;
}): number {
  const q = normalizeQuality(
    typeof params.quality === "string" ? params.quality : params.quality,
  );
  if (!q) return 0;
  const hours =
    (params.endAt.getTime() - params.startAt.getTime()) / (1000 * 60 * 60);
  return hours * params.baseCreditRatePerHour * qualityCreditMultiplier(q);
}

export function formatCredits(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

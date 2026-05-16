export type Quality = "useful" | "meh" | "wasted";

const QUALITY_MULT: Record<Quality, number> = {
  useful: 1,
  meh: 0.5,
  wasted: 0,
};

/** Credits for one stopped block (minutes-equivalent per spec §6.2). */
export function blockCreditsMinutes(params: {
  startAt: Date;
  endAt: Date;
  baseCreditRatePerHour: number;
  quality: Quality;
}): number {
  const hours =
    (params.endAt.getTime() - params.startAt.getTime()) / (1000 * 60 * 60);
  const mult = QUALITY_MULT[params.quality];
  return hours * params.baseCreditRatePerHour * mult;
}

export function formatCredits(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

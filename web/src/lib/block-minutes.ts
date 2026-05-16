/** Duration of a block in whole minutes (minimum 0). */
export function blockDurationMinutes(startAt: Date, endAt: Date): number {
  const ms = Math.max(0, endAt.getTime() - startAt.getTime());
  return Math.round(ms / 60_000);
}

/** Overlap of [blockStart, blockEnd] with [rangeStart, rangeEnd] in minutes. */
export function overlapMinutes(
  blockStart: Date,
  blockEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const start = Math.max(blockStart.getTime(), rangeStart.getTime());
  const end = Math.min(blockEnd.getTime(), rangeEnd.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

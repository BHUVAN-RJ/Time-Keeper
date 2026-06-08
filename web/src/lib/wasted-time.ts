/**
 * Wasted-time computation (US9 / FR-025/026/026a).
 *
 * "Wasted" time is any stretch INSIDE the user's configured active window that
 * has no recorded time block. It is a derived metric — no blocks are created —
 * so retroactively logging a block over a gap automatically reduces it.
 *
 * All math is done in "minutes from the business-day start (local 04:00)" so it
 * is timezone- and DST-safe given a correct `businessDayStartUtc`.
 */

const MIN = 60_000;
const DAY_MINUTES = 24 * 60;
const BOUNDARY_MINUTES = 4 * 60; // 04:00

type Interval = { start: number; end: number };

function hhmmToOffsetFromBoundary(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number.parseInt(x, 10));
  const minutesOfDay = (h ?? 0) * 60 + (m ?? 0);
  return (minutesOfDay - BOUNDARY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
}

/** Active window expressed as one or two intervals (minutes from boundary). */
function windowIntervals(start: string, end: string): Interval[] {
  const s = hhmmToOffsetFromBoundary(start);
  const e = hhmmToOffsetFromBoundary(end);
  if (s === e) {
    // Degenerate / full-day window.
    return [{ start: 0, end: DAY_MINUTES }];
  }
  if (e > s) return [{ start: s, end: e }];
  // Wraps past the boundary within the business day.
  return [
    { start: s, end: DAY_MINUTES },
    { start: 0, end: e },
  ];
}

function clampOverlap(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

function mergedLength(intervals: Interval[]): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals.slice().sort((x, y) => x.start - y.start);
  let total = 0;
  let curStart = sorted[0]!.start;
  let curEnd = sorted[0]!.end;
  for (let i = 1; i < sorted.length; i++) {
    const iv = sorted[i]!;
    if (iv.start <= curEnd) {
      curEnd = Math.max(curEnd, iv.end);
    } else {
      total += curEnd - curStart;
      curStart = iv.start;
      curEnd = iv.end;
    }
  }
  total += curEnd - curStart;
  return total;
}

export function computeWastedMinutes(params: {
  businessDayStartUtc: Date;
  /** Blocks overlapping the business day. Running blocks have endAt = null. */
  blocks: { startAt: Date; endAt: Date | null }[];
  window: { start: string; end: string };
  /** "Now" for clamping running blocks and not counting future gaps. */
  now?: Date;
}): number {
  const { businessDayStartUtc, blocks, window } = params;
  const now = params.now ?? new Date();
  const dayStartMs = businessDayStartUtc.getTime();

  const toOffset = (d: Date) => (d.getTime() - dayStartMs) / MIN;
  const nowOffset = toOffset(now);

  const windows = windowIntervals(window.start, window.end)
    // Only evaluate window time that has already elapsed (no future "waste").
    .map((w) => ({ start: w.start, end: Math.min(w.end, nowOffset) }))
    .filter((w) => w.end > w.start);
  if (windows.length === 0) return 0;

  const blockIntervals: Interval[] = blocks
    .map((b) => ({
      start: toOffset(new Date(b.startAt)),
      end: toOffset(b.endAt ? new Date(b.endAt) : now),
    }))
    .filter((iv) => iv.end > iv.start);

  let wasted = 0;
  for (const w of windows) {
    const coverage: Interval[] = [];
    for (const b of blockIntervals) {
      const ov = clampOverlap(w, b);
      if (ov) coverage.push(ov);
    }
    const covered = mergedLength(coverage);
    wasted += w.end - w.start - covered;
  }
  return Math.max(0, Math.round(wasted));
}

import type { getTodayData } from "@/actions/time-blocks";

type TodayData = Awaited<ReturnType<typeof getTodayData>>;

/** Stable snapshot for polling — omits elapsed seconds so the clock stays client-side. */
export function todayDataFingerprint(data: TodayData): string {
  return JSON.stringify({
    running: data.running
      ? {
          id: data.running.id,
          startAt: data.running.startAt,
          label: data.running.label,
          categoryId: data.running.categoryId,
        }
      : null,
    blocks: data.blocks.map((b) => ({
      id: b.id,
      endAt: b.endAt,
      label: b.label,
      quality: b.quality,
      categoryId: b.categoryId,
      credits: b.credits,
      tagNames: b.tagNames,
    })),
    suspiciousLongRun: data.suspiciousLongRun,
    calendarHeadline: data.calendarHeadline,
  });
}

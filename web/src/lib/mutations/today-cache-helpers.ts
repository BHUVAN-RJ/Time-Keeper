import type { getTodayData } from "@/actions/time-blocks";
import type { Quality } from "@/lib/quality";

export type TodayData = Awaited<ReturnType<typeof getTodayData>>;
export type TodayBlockRow = TodayData["blocks"][number];

export function clearRunningBlock(data: TodayData): TodayData {
  return {
    ...data,
    running: null,
    runningElapsedSeconds: 0,
  };
}

export function appendCompletedBlock(
  data: TodayData,
  block: TodayBlockRow,
): TodayData {
  return {
    ...clearRunningBlock(data),
    blocks: [block, ...data.blocks],
  };
}

export function buildStoppedBlock(
  running: NonNullable<TodayData["running"]>,
  input: {
    categoryId: string;
    label: string;
    quality: Quality;
    endAt?: string;
  },
): TodayBlockRow {
  const endAt = input.endAt ?? new Date().toISOString();
  return {
    ...running,
    endAt,
    label: input.label,
    quality: input.quality,
    categoryId: input.categoryId,
    credits: running.credits,
  };
}

export function insertBlock(data: TodayData, block: TodayBlockRow): TodayData {
  return {
    ...data,
    blocks: [block, ...data.blocks],
  };
}

export function updateBlockInList(
  data: TodayData,
  blockId: string,
  updater: (block: TodayBlockRow) => TodayBlockRow,
): TodayData {
  return {
    ...data,
    blocks: data.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
  };
}

export function removeBlockFromList(
  data: TodayData,
  blockId: string,
): TodayData {
  return {
    ...data,
    blocks: data.blocks.filter((b) => b.id !== blockId),
  };
}

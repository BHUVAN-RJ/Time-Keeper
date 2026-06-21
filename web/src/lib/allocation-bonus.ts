export type BlockAllocation = {
  taskId?: string | null;
  habitId?: string | null;
  projectId?: string | null;
};

/** 1× none, 2× task/habit, 3× project (project wins if multiple — caller must reject multiples). */
export function allocationCreditMultiplier(b: BlockAllocation): number {
  if (b.projectId) return 3;
  if (b.taskId) return 2;
  if (b.habitId) return 2;
  return 1;
}

export function allocationBonusLabel(b: BlockAllocation): string | null {
  const m = allocationCreditMultiplier(b);
  if (m === 3) return "3× project";
  if (m === 2) return b.habitId ? "2× habit" : "2× task";
  return null;
}

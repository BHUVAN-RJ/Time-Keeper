export type BlockAllocationFields = {
  projectId: string | null;
  habitId: string | null;
  taskId: string | null;
};

export function normalizeBlockAllocation(input: {
  projectId?: string | null;
  habitId?: string | null;
  taskId?: string | null;
}): BlockAllocationFields {
  const projectId = input.projectId?.trim() || null;
  const habitId = input.habitId?.trim() || null;
  const taskId = input.taskId?.trim() || null;
  const count = [projectId, habitId, taskId].filter(Boolean).length;
  if (count > 1) {
    throw new Error("Only one allocation target allowed");
  }
  return { projectId, habitId, taskId };
}

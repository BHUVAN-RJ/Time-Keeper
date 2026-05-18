/** Eisenhower quadrant helpers — spec §6.7, §5.4 */

export type Quadrant = 1 | 2 | 3 | 4;

export const QUADRANTS: Quadrant[] = [1, 2, 3, 4];

export const QUADRANT_META: Record<
  Quadrant,
  { code: string; title: string; subtitle: string }
> = {
  1: { code: "Q1", title: "Do first", subtitle: "Urgent & important" },
  2: { code: "Q2", title: "Schedule", subtitle: "Important, not urgent" },
  3: { code: "Q3", title: "Delegate", subtitle: "Urgent, not important" },
  4: { code: "Q4", title: "Later", subtitle: "Neither" },
};

/** urgency ≤ 2 = urgent; importance ≤ 2 = important */
export function eisenhowerQuadrant(
  urgency: number,
  importance: number,
): Quadrant {
  if (urgency <= 2 && importance <= 2) return 1;
  if (urgency > 2 && importance <= 2) return 2;
  if (urgency <= 2 && importance > 2) return 3;
  return 4;
}

/** Canonical priority when a card is dropped in a quadrant */
export function quadrantToPriority(quadrant: Quadrant): {
  urgency: number;
  importance: number;
} {
  switch (quadrant) {
    case 1:
      return { urgency: 1, importance: 1 };
    case 2:
      return { urgency: 3, importance: 1 };
    case 3:
      return { urgency: 1, importance: 3 };
    case 4:
      return { urgency: 3, importance: 3 };
  }
}

export function quadrantContainerId(quadrant: Quadrant): string {
  return `quadrant-${quadrant}`;
}

export function parseQuadrantContainerId(id: string): Quadrant | null {
  const m = /^quadrant-([1-4])$/.exec(id);
  if (!m) return null;
  return Number(m[1]) as Quadrant;
}

export type TaskPriorityLike = {
  urgency: number;
  importance: number;
  dueDate?: string | null;
  sortOrder: number;
};

export function compareTasksForToday(a: TaskPriorityLike, b: TaskPriorityLike) {
  const qa = eisenhowerQuadrant(a.urgency, a.importance);
  const qb = eisenhowerQuadrant(b.urgency, b.importance);
  if (qa !== qb) return qa - qb;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.sortOrder - b.sortOrder;
}

export function compareTasksInQuadrant(a: TaskPriorityLike, b: TaskPriorityLike) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return 0;
}

export function groupTasksByQuadrant<T extends TaskPriorityLike & { id: string }>(
  tasks: T[],
): Record<Quadrant, T[]> {
  const groups: Record<Quadrant, T[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const t of tasks) {
    const q = eisenhowerQuadrant(t.urgency, t.importance);
    groups[q].push(t);
  }
  for (const q of QUADRANTS) {
    groups[q].sort(compareTasksInQuadrant);
  }
  return groups;
}

export function layoutFromTasks<T extends TaskPriorityLike & { id: string }>(
  tasks: T[],
): Record<Quadrant, string[]> {
  const groups = groupTasksByQuadrant(tasks);
  return {
    1: groups[1].map((t) => t.id),
    2: groups[2].map((t) => t.id),
    3: groups[3].map((t) => t.id),
    4: groups[4].map((t) => t.id),
  };
}

export function matrixLayoutToPayload(
  items: Record<Quadrant, string[]>,
): { quadrant: Quadrant; taskIds: string[] }[] {
  return QUADRANTS.map((quadrant) => ({
    quadrant,
    taskIds: items[quadrant] ?? [],
  }));
}

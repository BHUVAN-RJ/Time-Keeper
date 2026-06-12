import type { TaskRow } from "@/actions/tasks";
import {
  compareTasksForToday,
  groupTasksByQuadrant,
  layoutFromTasks,
  QUADRANTS,
} from "@/lib/eisenhower";
import type { TasksPageData } from "@/lib/queries/tasks";

const ACTIVE_STATUSES = ["backlog", "scheduled", "in_progress"] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

function sortRemaining(rows: TaskRow[], today: string): TaskRow[] {
  const bucket = (t: TaskRow): number => {
    const date = t.scheduledDate ?? t.dueDate ?? null;
    if (t.status === "in_progress") return 0;
    if (date == null) return 2;
    return date <= today ? 0 : 1;
  };
  return rows.slice().sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    const da = a.scheduledDate ?? a.dueDate ?? "9999-12-31";
    const db_ = b.scheduledDate ?? b.dueDate ?? "9999-12-31";
    if (da !== db_) return da < db_ ? -1 : 1;
    return 0;
  });
}

export function collectAllActiveTasks(data: TasksPageData): TaskRow[] {
  const byId = new Map<string, TaskRow>();
  for (const q of QUADRANTS) {
    for (const t of data.matrixByQuadrant[q]) {
      byId.set(t.id, t);
    }
  }
  return Array.from(byId.values());
}

export function rebuildTasksPageData(
  data: TasksPageData,
  all: TaskRow[],
): TasksPageData {
  const today = data.today;
  const todayTasks = all
    .filter(
      (t) =>
        ACTIVE_STATUSES.includes(t.status as ActiveStatus) &&
        (t.scheduledDate === today ||
          t.dueDate === today ||
          t.status === "in_progress"),
    )
    .sort(compareTasksForToday);

  const backlogTasks = all.filter(
    (t) =>
      t.status === "backlog" ||
      (t.status === "scheduled" &&
        t.scheduledDate !== today &&
        t.dueDate !== today),
  );

  return {
    ...data,
    todayTasks,
    backlogTasks,
    remainingTasks: sortRemaining(all, today),
    matrixByQuadrant: groupTasksByQuadrant(all),
    matrixLayout: layoutFromTasks(all),
  };
}

export function insertOptimisticTask(
  data: TasksPageData,
  task: TaskRow,
): TasksPageData {
  const all = [...collectAllActiveTasks(data), task];
  return rebuildTasksPageData(data, all);
}

export function updateTaskInCache(
  data: TasksPageData,
  taskId: string,
  updater: (task: TaskRow) => TaskRow,
): TasksPageData {
  const all = collectAllActiveTasks(data).map((t) =>
    t.id === taskId ? updater(t) : t,
  );
  return rebuildTasksPageData(data, all);
}

export function removeTaskFromCache(
  data: TasksPageData,
  taskId: string,
): TasksPageData {
  const all = collectAllActiveTasks(data).filter((t) => t.id !== taskId);
  return rebuildTasksPageData(data, all);
}

export function replaceTempId(
  data: TasksPageData,
  tempId: string,
  realId: string,
): TasksPageData {
  const all = collectAllActiveTasks(data).map((t) =>
    t.id === tempId ? { ...t, id: realId } : t,
  );
  return rebuildTasksPageData(data, all);
}

export function buildOptimisticTaskRow(input: {
  id: string;
  title: string;
  estimateMinutes: number;
  categoryId?: string | null;
  projectId?: string | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  data: TasksPageData;
  urgency?: number;
  importance?: number;
}): TaskRow {
  const status =
    input.scheduledDate || input.dueDate ? "scheduled" : "backlog";
  const cat = input.data.categories.find((c) => c.id === input.categoryId);
  const project = input.data.activeProjects.find(
    (p) => p.id === input.projectId,
  );
  const now = new Date();
  return {
    id: input.id,
    userId: "",
    title: input.title,
    description: null,
    categoryId: input.categoryId ?? null,
    projectId: input.projectId ?? null,
    estimateMinutes: input.estimateMinutes,
    actualMinutes: 0,
    dueDate: input.dueDate ?? null,
    scheduledDate: input.scheduledDate ?? null,
    urgency: input.urgency ?? 3,
    importance: input.importance ?? 3,
    status,
    sortOrder: 0,
    rescheduleCount: 0,
    completedAt: null,
    droppedAt: null,
    dropReason: null,
    createdAt: now,
    updatedAt: now,
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    projectName: project?.name ?? null,
    tags: [],
  };
}

export function affectsToday(
  data: TasksPageData,
  scheduledDate?: string | null,
  dueDate?: string | null,
): boolean {
  const today = data.today;
  return scheduledDate === today || dueDate === today;
}

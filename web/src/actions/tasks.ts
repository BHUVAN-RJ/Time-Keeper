"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, projects, tasks } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { businessDayInTz as calendarDayInTz } from "@/lib/day-boundary";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { listActiveProjects } from "@/actions/projects";
import { getTagsEnabledForUser } from "@/actions/preferences";
import {
  compareTasksForToday,
  groupTasksByQuadrant,
  layoutFromTasks,
  quadrantToPriority,
  type Quadrant,
} from "@/lib/eisenhower";
import { listTagsForUser, setTaskTags, tagsForTasks } from "@/lib/tag-utils";
import { syncTaskActualMinutes } from "@/lib/task-utils";
import { parseQuickAdd } from "@/lib/quick-add-parse";
import { computeDaySnapshot } from "@/lib/day-compute";
import { estimateAccuracyMultiplier } from "@/lib/estimate-accuracy";

export type TaskRow = typeof tasks.$inferSelect & {
  categoryName: string | null;
  categoryColor: string | null;
  projectName: string | null;
  tags: { id: string; name: string }[];
};

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

const ACTIVE_STATUSES = ["backlog", "scheduled", "in_progress"] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

async function taskRowsForUser(userId: string): Promise<TaskRow[]> {
  const rows = await db
    .select({
      task: tasks,
      categoryName: categories.name,
      categoryColor: categories.color,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(eq(tasks.userId, userId), inArray(tasks.status, [...ACTIVE_STATUSES])),
    )
    .orderBy(desc(tasks.updatedAt));

  const mapped = rows.map((r) => ({
    ...r.task,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    projectName: r.projectName,
    tags: [] as { id: string; name: string }[],
  }));
  const tagMap = await tagsForTasks(
    userId,
    mapped.map((t) => t.id),
  );
  return mapped.map((t) => ({ ...t, tags: tagMap.get(t.id) ?? [] }));
}

export async function getTasksPageData() {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const all = await taskRowsForUser(userId);

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

  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.archived, false)));

  const tagsEnabled = await getTagsEnabledForUser(userId);
  const [estimateHint, activeProjects, allTags] = await Promise.all([
    estimateAccuracyMultiplier(userId),
    listActiveProjects(),
    tagsEnabled ? listTagsForUser(userId) : Promise.resolve([]),
  ]);

  const matrixByQuadrant = groupTasksByQuadrant(all);
  const matrixLayout = layoutFromTasks(all);
  const remainingTasks = sortRemaining(all, today);

  return {
    timezone,
    today,
    todayTasks,
    backlogTasks,
    remainingTasks,
    matrixByQuadrant,
    matrixLayout,
    categories: cats,
    allTags,
    tagsEnabled,
    activeProjects,
    estimateHint: estimateHint.ready
      ? {
          multiplier: estimateHint.multiplier,
          completedCount: estimateHint.completedCount,
        }
      : null,
  };
}

export async function createTaskAction(input: {
  title: string;
  estimateMinutes: number;
  categoryId?: string | null;
  projectId?: string | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  urgency?: number;
  importance?: number;
  description?: string | null;
  tagIds?: string[];
}) {
  const { userId } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const estimateMinutes = Math.round(input.estimateMinutes);
  if (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0) {
    throw new Error("Estimate must be a positive number of minutes");
  }

  const status =
    input.scheduledDate || input.dueDate ? "scheduled" : "backlog";

  const inserted = await db
    .insert(tasks)
    .values({
      userId,
      title,
      description: input.description?.trim() || null,
      categoryId: input.categoryId || null,
      projectId: input.projectId?.trim() || null,
      estimateMinutes,
      dueDate: input.dueDate || null,
      scheduledDate: input.scheduledDate || null,
      urgency: clamp14(input.urgency ?? 3),
      importance: clamp14(input.importance ?? 3),
      status,
    })
    .returning({ id: tasks.id });

  if (
    input.tagIds?.length &&
    inserted[0] &&
    (await getTagsEnabledForUser(userId))
  ) {
    await setTaskTags(userId, inserted[0].id, input.tagIds);
  }

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function updateTaskAction(
  taskId: string,
  fields: {
    title?: string;
    estimateMinutes?: number;
    categoryId?: string | null;
    projectId?: string | null;
    dueDate?: string | null;
    scheduledDate?: string | null;
    description?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await requireUser();
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!existing) return { ok: false, error: "Task not found" };

  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

  if (fields.title !== undefined) {
    const title = fields.title.trim();
    if (!title) return { ok: false, error: "Title is required" };
    set.title = title;
  }
  if (fields.estimateMinutes !== undefined) {
    const est = Math.round(fields.estimateMinutes);
    if (!Number.isFinite(est) || est <= 0) {
      return { ok: false, error: "Estimate must be a positive number of minutes" };
    }
    set.estimateMinutes = est;
  }
  if (fields.categoryId !== undefined) set.categoryId = fields.categoryId || null;
  if (fields.projectId !== undefined) {
    set.projectId = fields.projectId?.trim() || null;
  }
  if (fields.description !== undefined) {
    set.description = fields.description?.trim() || null;
  }
  if (fields.dueDate !== undefined) set.dueDate = fields.dueDate || null;
  if (fields.scheduledDate !== undefined) {
    set.scheduledDate = fields.scheduledDate || null;
  }

  // Keep status coherent with scheduling for non-terminal tasks.
  if (
    (fields.scheduledDate !== undefined || fields.dueDate !== undefined) &&
    (existing.status === "backlog" || existing.status === "scheduled")
  ) {
    const nextScheduled =
      fields.scheduledDate !== undefined
        ? fields.scheduledDate || null
        : existing.scheduledDate;
    const nextDue =
      fields.dueDate !== undefined ? fields.dueDate || null : existing.dueDate;
    set.status = nextScheduled || nextDue ? "scheduled" : "backlog";
  }

  await db
    .update(tasks)
    .set(set)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/week");
  return { ok: true };
}

/**
 * Order open tasks overdue/today first, then upcoming (future-dated), then
 * undated backlog (US5 / FR-014/014a).
 */
function sortRemaining(rows: TaskRow[], today: string): TaskRow[] {
  const bucket = (t: TaskRow): number => {
    const date = t.scheduledDate ?? t.dueDate ?? null;
    if (t.status === "in_progress") return 0;
    if (date == null) return 2; // undated backlog
    return date <= today ? 0 : 1; // overdue/today : upcoming
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

/** All remaining (open) tasks regardless of date (US5 / FR-014/014a). */
export async function getRemainingTasks(): Promise<TaskRow[]> {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const rows = await taskRowsForUser(userId);
  return sortRemaining(rows, today);
}

export async function completeTaskAction(taskId: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const before = await computeDaySnapshot(userId, today, timezone);

  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Task not found");
  if (row.status === "completed" || row.status === "dropped") return;

  const actual = await syncTaskActualMinutes(taskId, userId);

  await db
    .update(tasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      actualMinutes: actual,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/stats");

  const after = await computeDaySnapshot(userId, today, timezone);
  const scoreDelta = after.productivityScore - before.productivityScore;

  const delta =
    row.estimateMinutes > 0
      ? Math.round(((actual - row.estimateMinutes) / row.estimateMinutes) * 100)
      : 0;
  return {
    estimateMinutes: row.estimateMinutes,
    actualMinutes: actual,
    deltaPercent: delta,
    scoreDelta,
    scoreAfter: after.productivityScore,
    showScoreToast: scoreDelta >= 3,
  };
}

export async function createTaskFromQuickAddAction(raw: string) {
  const parsed = parseQuickAdd(raw);
  const { timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  await createTaskAction({
    title: parsed.title,
    estimateMinutes: parsed.estimateMinutes,
    dueDate: parsed.dueDate,
    scheduledDate: parsed.dueDate === today ? today : null,
    urgency: parsed.urgency,
    importance: parsed.importance,
  });
}

export async function dropTaskAction(taskId: string, reason: string) {
  const { userId } = await requireUser();
  const dropReason = reason.trim();
  if (!dropReason) throw new Error("Drop reason is required");

  await db
    .update(tasks)
    .set({
      status: "dropped",
      droppedAt: new Date(),
      dropReason,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function scheduleTaskForTodayAction(taskId: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);

  await db
    .update(tasks)
    .set({
      scheduledDate: today,
      status: "scheduled",
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
  revalidatePath("/today");
}

function clamp14(n: number) {
  return Math.min(4, Math.max(1, Math.round(n)));
}

export type MatrixLayoutInput = {
  quadrant: Quadrant;
  taskIds: string[];
}[];

/** Persist Eisenhower board order after drag-and-drop */
export async function applyMatrixLayoutAction(layout: MatrixLayoutInput) {
  const { userId } = await requireUser();

  const seen = new Set<string>();
  for (const { taskIds } of layout) {
    for (const id of taskIds) {
      if (seen.has(id)) throw new Error("Duplicate task in layout");
      seen.add(id);
    }
  }

  const activeRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(eq(tasks.userId, userId), inArray(tasks.status, [...ACTIVE_STATUSES])),
    );
  const activeIds = new Set(activeRows.map((r) => r.id));

  for (const id of seen) {
    if (!activeIds.has(id)) throw new Error("Invalid task");
  }
  for (const id of activeIds) {
    if (!seen.has(id)) throw new Error("Layout must include every active task");
  }

  const now = new Date();
  for (const { quadrant, taskIds } of layout) {
    const { urgency, importance } = quadrantToPriority(quadrant);
    for (let i = 0; i < taskIds.length; i++) {
      await db
        .update(tasks)
        .set({
          urgency,
          importance,
          sortOrder: i,
          updatedAt: now,
        })
        .where(and(eq(tasks.id, taskIds[i]), eq(tasks.userId, userId)));
    }
  }

  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/week");
}

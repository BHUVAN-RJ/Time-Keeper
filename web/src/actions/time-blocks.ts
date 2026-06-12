"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  categories,
  tags,
  tasks,
  timeBlocks,
  timeBlockTags,
  userPreferences,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { tryApplyVariableBonus } from "@/lib/credits-bonus";
import { blockCreditsMinutes } from "@/lib/credits";
import { isQuality, normalizeQuality, type Quality } from "@/lib/quality";

export type BlockActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };
import {
  businessDayInTz,
  businessDayStartUtc,
  getBusinessDayRangeUtc,
} from "@/lib/day-boundary";
import { parseRemindAtLocal } from "@/lib/reminders";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { listActiveProjects } from "@/actions/projects";
import {
  autoStopStaleRunningBlock,
  clearTimerActivity,
  recordTimerActivity,
} from "@/lib/running-timer-idle";
import {
  getActiveWindowForUser,
  getTagsEnabledForUser,
} from "@/actions/preferences";
import { computeWastedMinutes } from "@/lib/wasted-time";
import { listTagsForUser, setBlockTags } from "@/lib/tag-utils";
import { syncTaskActualMinutes } from "@/lib/task-utils";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const tz = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, tz);
  return { userId: id, timezone: tz };
}

export type TodayBlockRow = {
  id: string;
  startAt: string;
  endAt: string | null;
  label: string | null;
  statedIntent?: string | null;
  quality: string | null;
  manualEntry: boolean;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  isFreeTime: boolean;
  baseCreditRate: number;
  credits: number | null;
  tagNames: string[];
};

export async function getTodayData(): Promise<{
  activeProjects: { id: string; name: string }[];
  timezone: string;
  /** "Thursday, May 15" style in user TZ — computed on server to avoid hydration drift */
  calendarHeadline: string;
  /** Whole seconds elapsed for running block; 0 if none */
  runningElapsedSeconds: number;
  running: TodayBlockRow | null;
  blocks: TodayBlockRow[];
  suspiciousLongRun: boolean;
  categories: { id: string; name: string; color: string; archived: boolean }[];
  allTags: { id: string; name: string }[];
  tagsEnabled: boolean;
  bodyDoublingIntervalMinutes: number;
  /** Derived in-window untracked minutes so far today (US9). */
  wastedMinutes: number;
}> {
  const { userId, timezone } = await requireUser();
  await autoStopStaleRunningBlock(userId);
  // Silent 4 AM rollover: split a timer that has run past the boundary so the
  // running block always belongs to the current business day (US2).
  await splitRunningBlockAtBoundary(userId, timezone);
  const activeProjects = await listActiveProjects();
  const now = new Date();
  const calendarHeadline = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const { startUtc, endUtc } = getBusinessDayRangeUtc(now, timezone);

  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      archived: categories.archived,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  const runningRows = await db
    .select({
      block: timeBlocks,
      category: categories,
    })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(and(eq(timeBlocks.userId, userId), isNull(timeBlocks.endAt)))
    .limit(1);

  const overlap = and(
    eq(timeBlocks.userId, userId),
    lte(timeBlocks.startAt, endUtc),
    or(isNull(timeBlocks.endAt), gte(timeBlocks.endAt, startUtc)),
  );

  const dayRows = await db
    .select({
      block: timeBlocks,
      category: categories,
    })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(overlap)
    .orderBy(desc(timeBlocks.startAt));

  const mapRow = (
    block: typeof timeBlocks.$inferSelect,
    cat: typeof categories.$inferSelect,
    tagNames: string[] = [],
  ): TodayBlockRow => {
    let credits: number | null = null;
    if (block.endAt && block.quality) {
      const q = normalizeQuality(block.quality);
      if (q) {
        let raw = blockCreditsMinutes({
          startAt: new Date(block.startAt),
          endAt: new Date(block.endAt),
          baseCreditRatePerHour: cat.baseCreditRate,
          quality: q,
        });
        if (block.randomBonusApplied) raw *= 1.5;
        credits = cat.isFreeTime ? -raw : raw;
      }
    }
    return {
      id: block.id,
      startAt: new Date(block.startAt).toISOString(),
      endAt: block.endAt ? new Date(block.endAt).toISOString() : null,
      label: block.label,
      statedIntent: block.statedIntent ?? null,
      quality: block.quality,
      manualEntry: block.manualEntry,
      categoryId: cat.id,
      categoryName: cat.name,
      categoryColor: cat.color,
      isFreeTime: cat.isFreeTime,
      baseCreditRate: cat.baseCreditRate,
      credits,
      tagNames,
    };
  };

  const blockIds = [
    ...new Set([
      ...dayRows.map((r) => r.block.id),
      ...runningRows.map((r) => r.block.id),
    ]),
  ];
  const tagNameMap = new Map<string, string[]>();
  if (blockIds.length > 0) {
    const tagRows = await db
      .select({
        blockId: timeBlockTags.timeBlockId,
        name: tags.name,
      })
      .from(timeBlockTags)
      .innerJoin(tags, eq(timeBlockTags.tagId, tags.id))
      .where(
        and(eq(tags.userId, userId), inArray(timeBlockTags.timeBlockId, blockIds)),
      );
    for (const tr of tagRows) {
      const list = tagNameMap.get(tr.blockId) ?? [];
      list.push(tr.name);
      tagNameMap.set(tr.blockId, list);
    }
  }

  const running = runningRows[0]
    ? mapRow(
        runningRows[0].block,
        runningRows[0].category,
        tagNameMap.get(runningRows[0].block.id) ?? [],
      )
    : null;

  const runningElapsedSeconds = running
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(running.startAt).getTime()) / 1000,
        ),
      )
    : 0;

  const seen = new Set<string>();
  const blocks: TodayBlockRow[] = [];
  for (const r of dayRows) {
    if (seen.has(r.block.id)) continue;
    seen.add(r.block.id);
    blocks.push(mapRow(r.block, r.category, tagNameMap.get(r.block.id) ?? []));
  }

  const suspiciousLongRun =
    !!running &&
    Date.now() - new Date(running.startAt).getTime() > 24 * 60 * 60 * 1000;

  const [allTags, prefRow] = await Promise.all([
    listTagsForUser(userId),
    db
      .select({
        m: userPreferences.bodyDoublingIntervalMinutes,
        tagsEnabled: userPreferences.tagsEnabled,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1)
      .then((r) => r[0]),
  ]);
  // Tags removed in favor of a single Label dimension (US8).
  const tagsEnabled = false;

  const window = await getActiveWindowForUser(userId);
  const wastedMinutes = computeWastedMinutes({
    businessDayStartUtc: startUtc,
    blocks: [
      ...dayRows.map((r) => ({
        startAt: new Date(r.block.startAt),
        endAt: r.block.endAt ? new Date(r.block.endAt) : null,
      })),
      ...runningRows.map((r) => ({
        startAt: new Date(r.block.startAt),
        endAt: null as Date | null,
      })),
    ],
    window,
    now,
  });

  return {
    activeProjects,
    timezone,
    calendarHeadline,
    runningElapsedSeconds,
    running,
    blocks,
    suspiciousLongRun,
    categories: cats,
    allTags: tagsEnabled ? allTags : [],
    tagsEnabled,
    bodyDoublingIntervalMinutes: prefRow?.m ?? 0,
    wastedMinutes,
  };
}

export type TodayData = Awaited<ReturnType<typeof getTodayData>>;

export type PollTodayDataResult =
  | { ok: true; data: TodayData }
  | { ok: false; unauthorized: true };

/** Client polling — never throws on auth loss (avoids broken server-action responses). */
export async function pollTodayData(): Promise<PollTodayDataResult> {
  try {
    const data = await getTodayData();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, unauthorized: true };
    }
    throw e;
  }
}

/**
 * If a running block started before the current business-day boundary (4 AM),
 * close it at the boundary and start a fresh running block for the new day that
 * carries forward the prior block's context. Idempotent and safe to call on
 * every Today load (US2 / FR-007).
 */
export async function splitRunningBlockAtBoundary(
  userId: string,
  timezone: string,
): Promise<void> {
  const now = new Date();
  const boundary = businessDayStartUtc(now, timezone);
  const [running] = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), isNull(timeBlocks.endAt)))
    .limit(1);
  if (!running) return;
  if (new Date(running.startAt) >= boundary) return; // started today — nothing to do

  // Close the old segment at the boundary, then open a new running block.
  await db
    .update(timeBlocks)
    .set({ endAt: boundary, quality: running.quality ?? "meh", updatedAt: now })
    .where(and(eq(timeBlocks.id, running.id), isNull(timeBlocks.endAt)));

  try {
    await db.insert(timeBlocks).values({
      userId,
      categoryId: running.categoryId,
      taskId: running.taskId ?? null,
      projectId: running.projectId ?? null,
      startAt: boundary,
      label: running.label,
      statedIntent: running.statedIntent ?? null,
      manualEntry: false,
      randomBonusApplied: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    // If a concurrent reconcile already created the new running block, ignore.
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("UNIQUE") && !msg.includes("unique")) throw e;
  }
  await recordTimerActivity(userId);
  revalidatePath("/today");
}

export async function startBlockAction(
  categoryId: string,
  taskId?: string | null,
  statedIntent?: string | null,
) {
  const { userId } = await requireUser();
  const now = new Date();
  let label: string | null = null;
  let projectId: string | null = null;
  if (taskId) {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);
    if (!task) throw new Error("Task not found");
    label = task.title;
    if (task.categoryId) categoryId = task.categoryId;
    projectId = task.projectId;
    await db
      .update(tasks)
      .set({ status: "in_progress", updatedAt: now })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  }
  try {
    const inserted = await db
      .insert(timeBlocks)
      .values({
        userId,
        categoryId,
        taskId: taskId ?? null,
        projectId,
        startAt: now,
        label,
        statedIntent: statedIntent?.trim() || null,
        manualEntry: false,
        randomBonusApplied: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: timeBlocks.id })
      .get();
    if (!inserted?.id) throw new Error("Insert returned no id");
    await recordTimerActivity(userId);
    revalidatePath("/today");
    revalidatePath("/tasks");
    return { ok: true as const, blockId: inserted.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return { ok: false as const, code: "ALREADY_RUNNING" as const };
    }
    throw e;
  }
}

export async function stopBlockAction(input: {
  blockId: string;
  categoryId: string;
  /** Optional: classification is the Label (categoryId); free-text label is deprecated. */
  label?: string;
  quality: Quality;
  notes?: string;
  projectId?: string | null;
  tagIds?: string[];
}): Promise<{ ok: true; luckyBonus?: boolean }> {
  const { userId, timezone } = await requireUser();
  const now = new Date();
  const [running] = await db
    .select()
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.id, input.blockId),
        eq(timeBlocks.userId, userId),
        isNull(timeBlocks.endAt),
      ),
    )
    .limit(1);

  if (!running) {
    throw new Error("No running block found");
  }

  const categoryId = input.categoryId.trim() || running.categoryId;
  const label = (input.label ?? "").trim() || running.label || null;
  if (!categoryId) throw new Error("Label is required");
  if (!label) throw new Error("Label is required");

  const [cat] = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.id, categoryId), eq(categories.userId, userId)),
    )
    .limit(1);

  const projectId = input.projectId?.trim() || null;

  await db
    .update(timeBlocks)
    .set({
      endAt: now,
      categoryId,
      label,
      quality: input.quality,
      notes: input.notes?.trim() || null,
      projectId,
      updatedAt: now,
    })
    .where(
      and(
        eq(timeBlocks.id, input.blockId),
        eq(timeBlocks.userId, userId),
        isNull(timeBlocks.endAt),
      ),
    );

  let luckyBonus = false;
  if (cat && !cat.isFreeTime) {
    const bonus = await tryApplyVariableBonus({
      userId,
      blockId: input.blockId,
      quality: input.quality,
      startAt: new Date(running.startAt),
      endAt: now,
      baseCreditRatePerHour: cat.baseCreditRate,
      timezone,
    });
    luckyBonus = bonus.applied;
  }

  if (running?.taskId) {
    await syncTaskActualMinutes(running.taskId, userId);
  }
  if (input.tagIds?.length && (await getTagsEnabledForUser(userId))) {
    await setBlockTags(userId, input.blockId, input.tagIds);
  }
  await clearTimerActivity(userId);
  revalidatePath("/today");
  revalidatePath("/tasks");
  return { ok: true as const, luckyBonus };
}

/**
 * Recovery path: finalize a running block even when the normal stop inputs are
 * unavailable (e.g. a stuck/locked timer). Sets endAt = now with a safe default
 * quality so the app can never be left unusable by a running block (US1).
 */
export async function forceStopBlockAction(
  blockId: string,
): Promise<BlockActionResult> {
  const { userId } = await requireUser();
  const now = new Date();
  const [running] = await db
    .select()
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.id, blockId),
        eq(timeBlocks.userId, userId),
        isNull(timeBlocks.endAt),
      ),
    )
    .limit(1);
  if (!running) {
    // Already stopped — treat as success so the UI can recover.
    revalidatePath("/today");
    return { ok: true };
  }
  await db
    .update(timeBlocks)
    .set({
      endAt: now,
      quality: running.quality ?? "meh",
      updatedAt: now,
    })
    .where(
      and(
        eq(timeBlocks.id, blockId),
        eq(timeBlocks.userId, userId),
        isNull(timeBlocks.endAt),
      ),
    );
  if (running.taskId) {
    await syncTaskActualMinutes(running.taskId, userId);
  }
  revalidatePath("/today");
  revalidatePath("/tasks");
  return { ok: true };
}

export async function startBlockForTaskAction(taskId: string) {
  const { userId } = await requireUser();
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) throw new Error("Task not found");

  const cats = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.archived, false)),
    );
  const categoryId =
    task.categoryId ??
    cats.find((c) => !c.isFreeTime && c.name !== "Sleep")?.id ??
    cats[0]?.id;
  if (!categoryId) throw new Error("Add a category first");

  return startBlockAction(categoryId, taskId);
}

function isHm(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value.trim());
}

export async function createManualBlockAction(input: {
  categoryId: string;
  startTime: string;
  endTime: string;
  label: string;
  quality: Quality;
  notes?: string;
  projectId?: string | null;
  tagIds?: string[];
}): Promise<BlockActionResult> {
  const { userId, timezone } = await requireUser();
  const startTime = input.startTime.trim();
  const endTime = input.endTime.trim();
  if (!isHm(startTime) || !isHm(endTime)) {
    return { ok: false, error: "Pick valid start and end times." };
  }
  const businessDay = businessDayInTz(new Date(), timezone);
  let start: Date;
  let end: Date;
  try {
    start = parseRemindAtLocal(`${businessDay}T${startTime}`, timezone);
    end = parseRemindAtLocal(`${businessDay}T${endTime}`, timezone);
  } catch {
    return { ok: false, error: "Pick valid start and end times." };
  }
  if (!(end > start)) {
    return { ok: false, error: "End time must be after start time." };
  }
  if (!isQuality(input.quality)) {
    return { ok: false, error: "Pick a quality rating." };
  }
  const now = new Date();
  const inserted = await db
    .insert(timeBlocks)
    .values({
      userId,
      categoryId: input.categoryId,
      projectId: input.projectId?.trim() || null,
      startAt: start,
      endAt: end,
      label: input.label.trim(),
      quality: input.quality,
      notes: input.notes?.trim() || null,
      manualEntry: true,
      randomBonusApplied: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: timeBlocks.id });
  if (
    input.tagIds?.length &&
    inserted[0] &&
    (await getTagsEnabledForUser(userId))
  ) {
    await setBlockTags(userId, inserted[0].id, input.tagIds);
  }
  revalidatePath("/today");
  return { ok: true, id: inserted[0]!.id };
}

export async function updateBlockAction(input: {
  blockId: string;
  categoryId: string;
  startAt: string;
  endAt: string | null;
  label: string;
  quality: Quality | null;
  notes?: string;
  projectId?: string | null;
}): Promise<BlockActionResult> {
  const { userId } = await requireUser();
  const start = new Date(input.startAt);
  const end = input.endAt ? new Date(input.endAt) : null;
  if (end && !(end > start)) {
    return { ok: false, error: "End time must be after start time." };
  }
  if (end && input.quality && !isQuality(input.quality)) {
    return { ok: false, error: "Pick a quality rating." };
  }
  const now = new Date();
  await db
    .update(timeBlocks)
    .set({
      categoryId: input.categoryId,
      startAt: start,
      endAt: end,
      label: input.label.trim(),
      quality: input.quality,
      notes: input.notes?.trim() || null,
      projectId: input.projectId?.trim() || null,
      updatedAt: now,
    })
    .where(and(eq(timeBlocks.id, input.blockId), eq(timeBlocks.userId, userId)));
  revalidatePath("/today");
  return { ok: true };
}

export async function deleteBlockAction(
  blockId: string,
): Promise<BlockActionResult> {
  const { userId } = await requireUser();
  const deleted = await db
    .delete(timeBlocks)
    .where(and(eq(timeBlocks.id, blockId), eq(timeBlocks.userId, userId)))
    .returning({ id: timeBlocks.id });
  if (deleted.length === 0) {
    return { ok: false, error: "Block not found or already deleted." };
  }
  revalidatePath("/today");
  return { ok: true };
}

/** Body-doubling dismiss and other explicit check-ins count as timer activity. */
export async function acknowledgeTimerActivityAction(): Promise<void> {
  const { userId } = await requireUser();
  const [running] = await db
    .select({ id: timeBlocks.id })
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), isNull(timeBlocks.endAt)))
    .limit(1);
  if (!running) return;
  await recordTimerActivity(userId);
}

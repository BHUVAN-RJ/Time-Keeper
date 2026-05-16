"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories, timeBlocks } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { blockCreditsMinutes, type Quality } from "@/lib/credits";
import { getDayRangeUtc } from "@/lib/day-range";
import { ensureDefaultCategories } from "@/lib/ensure-categories";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const tz = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id);
  return { userId: id, timezone: tz };
}

export type TodayBlockRow = {
  id: string;
  startAt: string;
  endAt: string | null;
  label: string | null;
  quality: string | null;
  manualEntry: boolean;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  isFreeTime: boolean;
  baseCreditRate: number;
  credits: number | null;
};

export async function getTodayData(): Promise<{
  timezone: string;
  /** "Thursday, May 15" style in user TZ — computed on server to avoid hydration drift */
  calendarHeadline: string;
  /** Whole seconds elapsed for running block; 0 if none */
  runningElapsedSeconds: number;
  running: TodayBlockRow | null;
  blocks: TodayBlockRow[];
  creditBalance: number;
  suspiciousLongRun: boolean;
  categories: { id: string; name: string; color: string; archived: boolean }[];
}> {
  const { userId, timezone } = await requireUser();
  const now = new Date();
  const calendarHeadline = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const { startUtc, endUtc } = getDayRangeUtc(now, timezone);

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
  ): TodayBlockRow => {
    let credits: number | null = null;
    if (block.endAt && block.quality) {
      const q = block.quality as Quality;
      if (q === "useful" || q === "meh" || q === "wasted") {
        const raw = blockCreditsMinutes({
          startAt: new Date(block.startAt),
          endAt: new Date(block.endAt),
          baseCreditRatePerHour: cat.baseCreditRate,
          quality: q,
        });
        credits = cat.isFreeTime ? -raw : raw;
      }
    }
    return {
      id: block.id,
      startAt: new Date(block.startAt).toISOString(),
      endAt: block.endAt ? new Date(block.endAt).toISOString() : null,
      label: block.label,
      quality: block.quality,
      manualEntry: block.manualEntry,
      categoryId: cat.id,
      categoryName: cat.name,
      categoryColor: cat.color,
      isFreeTime: cat.isFreeTime,
      baseCreditRate: cat.baseCreditRate,
      credits,
    };
  };

  const running = runningRows[0]
    ? mapRow(runningRows[0].block, runningRows[0].category)
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
    blocks.push(mapRow(r.block, r.category));
  }

  const allDone = await db
    .select({ block: timeBlocks, category: categories })
    .from(timeBlocks)
    .innerJoin(categories, eq(timeBlocks.categoryId, categories.id))
    .where(and(eq(timeBlocks.userId, userId), isNotNull(timeBlocks.endAt)));

  let creditBalance = 0;
  for (const r of allDone) {
    const q = r.block.quality as Quality | null;
    if (!q || (q !== "useful" && q !== "meh" && q !== "wasted")) continue;
    const raw = blockCreditsMinutes({
      startAt: new Date(r.block.startAt),
      endAt: new Date(r.block.endAt!),
      baseCreditRatePerHour: r.category.baseCreditRate,
      quality: q,
    });
    creditBalance += r.category.isFreeTime ? -raw : raw;
  }

  const suspiciousLongRun =
    !!running &&
    Date.now() - new Date(running.startAt).getTime() > 24 * 60 * 60 * 1000;

  return {
    timezone,
    calendarHeadline,
    runningElapsedSeconds,
    running,
    blocks,
    creditBalance,
    suspiciousLongRun,
    categories: cats,
  };
}

export async function startBlockAction(categoryId: string) {
  const { userId } = await requireUser();
  const now = new Date();
  try {
    const inserted = await db
      .insert(timeBlocks)
      .values({
        userId,
        categoryId,
        startAt: now,
        manualEntry: false,
        randomBonusApplied: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: timeBlocks.id })
      .get();
    if (!inserted?.id) throw new Error("Insert returned no id");
    revalidatePath("/today");
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
  label: string;
  quality: Quality;
  notes?: string;
}) {
  const { userId } = await requireUser();
  const now = new Date();
  await db
    .update(timeBlocks)
    .set({
      endAt: now,
      categoryId: input.categoryId,
      label: input.label.trim(),
      quality: input.quality,
      notes: input.notes?.trim() || null,
      updatedAt: now,
    })
    .where(
      and(
        eq(timeBlocks.id, input.blockId),
        eq(timeBlocks.userId, userId),
        isNull(timeBlocks.endAt),
      ),
    );
  revalidatePath("/today");
}

export async function createManualBlockAction(input: {
  categoryId: string;
  startAt: string;
  endAt: string;
  label: string;
  quality: Quality;
  notes?: string;
}) {
  const { userId } = await requireUser();
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (!(end > start)) throw new Error("End must be after start");
  const now = new Date();
  await db.insert(timeBlocks).values({
    userId,
    categoryId: input.categoryId,
    startAt: start,
    endAt: end,
    label: input.label.trim(),
    quality: input.quality,
    notes: input.notes?.trim() || null,
    manualEntry: true,
    randomBonusApplied: false,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/today");
}

export async function updateBlockAction(input: {
  blockId: string;
  categoryId: string;
  startAt: string;
  endAt: string | null;
  label: string;
  quality: Quality | null;
  notes?: string;
}) {
  const { userId } = await requireUser();
  const start = new Date(input.startAt);
  const end = input.endAt ? new Date(input.endAt) : null;
  if (end && !(end > start)) throw new Error("End must be after start");
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
      updatedAt: now,
    })
    .where(and(eq(timeBlocks.id, input.blockId), eq(timeBlocks.userId, userId)));
  revalidatePath("/today");
}

export async function deleteBlockAction(blockId: string) {
  const { userId } = await requireUser();
  await db
    .delete(timeBlocks)
    .where(and(eq(timeBlocks.id, blockId), eq(timeBlocks.userId, userId)));
  revalidatePath("/today");
}

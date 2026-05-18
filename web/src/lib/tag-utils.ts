import { db } from "@/db";
import { tags, taskTags, timeBlockTags } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type TagRow = { id: string; name: string };

export async function listTagsForUser(userId: string): Promise<TagRow[]> {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(tags.name);
}

export async function findOrCreateTag(userId: string, rawName: string): Promise<TagRow> {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new Error("Tag name is required");
  const [existing] = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, name)))
    .limit(1);
  if (existing) return existing;
  const now = new Date();
  const inserted = await db
    .insert(tags)
    .values({ userId, name, createdAt: now })
    .returning({ id: tags.id, name: tags.name });
  return inserted[0]!;
}

export async function tagIdsForTask(taskId: string): Promise<string[]> {
  const rows = await db
    .select({ tagId: taskTags.tagId })
    .from(taskTags)
    .where(eq(taskTags.taskId, taskId));
  return rows.map((r) => r.tagId);
}

export async function tagIdsForBlock(blockId: string): Promise<string[]> {
  const rows = await db
    .select({ tagId: timeBlockTags.tagId })
    .from(timeBlockTags)
    .where(eq(timeBlockTags.timeBlockId, blockId));
  return rows.map((r) => r.tagId);
}

export async function tagsForTasks(
  userId: string,
  taskIds: string[],
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (taskIds.length === 0) return map;
  const rows = await db
    .select({
      taskId: taskTags.taskId,
      id: tags.id,
      name: tags.name,
    })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(and(eq(tags.userId, userId), inArray(taskTags.taskId, taskIds)));
  for (const r of rows) {
    const list = map.get(r.taskId) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.taskId, list);
  }
  return map;
}

export async function setTaskTags(
  userId: string,
  taskId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length > 0) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
    if (owned.length !== tagIds.length) throw new Error("Invalid tag");
  }
  await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
  if (tagIds.length === 0) return;
  await db.insert(taskTags).values(
    tagIds.map((tagId) => ({ taskId, tagId })),
  );
}

export async function setBlockTags(
  userId: string,
  blockId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length > 0) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
    if (owned.length !== tagIds.length) throw new Error("Invalid tag");
  }
  await db.delete(timeBlockTags).where(eq(timeBlockTags.timeBlockId, blockId));
  if (tagIds.length === 0) return;
  await db.insert(timeBlockTags).values(
    tagIds.map((tagId) => ({ timeBlockId: blockId, tagId })),
  );
}

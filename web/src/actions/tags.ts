"use server";

import { auth } from "@/auth";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import {
  findOrCreateTag,
  listTagsForUser,
  setBlockTags,
  setTaskTags,
  type TagRow,
} from "@/lib/tag-utils";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id };
}

function revalidateTagPaths() {
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/reminders");
  revalidatePath("/stats");
  revalidatePath("/month");
}

export async function listTagsAction(): Promise<TagRow[]> {
  const { userId } = await requireUser();
  return listTagsForUser(userId);
}

export async function createTagAction(name: string): Promise<TagRow> {
  const { userId } = await requireUser();
  const tag = await findOrCreateTag(userId, name);
  revalidateTagPaths();
  return tag;
}

export async function setTaskTagsAction(taskId: string, tagIds: string[]) {
  const { userId } = await requireUser();
  await setTaskTags(userId, taskId, tagIds);
  revalidateTagPaths();
}

export async function setBlockTagsAction(blockId: string, tagIds: string[]) {
  const { userId } = await requireUser();
  await setBlockTags(userId, blockId, tagIds);
  revalidateTagPaths();
}

"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { categoryBlockCount, ensureDefaultCategories } from "@/lib/ensure-categories";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  await ensureDefaultCategories(id);
  return { userId: id };
}

export async function listCategoriesForUser() {
  const { userId } = await requireUser();
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(desc(categories.createdAt));
}

export async function createCategoryAction(input: {
  name: string;
  baseCreditRate: number;
  color: string;
  isFreeTime: boolean;
}) {
  const { userId } = await requireUser();
  await db.insert(categories).values({
    userId,
    name: input.name.trim(),
    baseCreditRate: input.baseCreditRate,
    color: input.color,
    isFreeTime: input.isFreeTime,
    archived: false,
  });
  revalidatePath("/today");
  revalidatePath("/categories");
}

export async function updateCategoryAction(
  id: string,
  input: {
    name: string;
    baseCreditRate: number;
    color: string;
    isFreeTime: boolean;
    archived: boolean;
  },
) {
  const { userId } = await requireUser();
  const [cur] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!cur) throw new Error("Category not found");

  const n = await categoryBlockCount(userId, id);
  if (n > 0 && input.archived && !cur.archived) {
    return { ok: false as const, code: "HAS_BLOCKS" as const };
  }
  await db
    .update(categories)
    .set({
      name: input.name.trim(),
      baseCreditRate: input.baseCreditRate,
      color: input.color,
      isFreeTime: input.isFreeTime,
      archived: input.archived,
    })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/today");
  revalidatePath("/categories");
  return { ok: true as const };
}

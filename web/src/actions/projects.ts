"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { projects, timeBlocks } from "@/db/schema";
import { and, desc, eq, isNotNull, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { subDays } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export type ProjectRow = typeof projects.$inferSelect;

export type ProjectListRow = ProjectRow & { trackedMinutes: number };

export async function listProjects(): Promise<ProjectListRow[]> {
  const { userId } = await requireUser();
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));

  const tracked = await db
    .select({
      projectId: timeBlocks.projectId,
      totalMinutes: sql<number>`coalesce(sum((${timeBlocks.endAt} - ${timeBlocks.startAt}) / 60000.0), 0)`,
    })
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.userId, userId),
        isNotNull(timeBlocks.endAt),
        isNotNull(timeBlocks.projectId),
      ),
    )
    .groupBy(timeBlocks.projectId);

  const minutesByProject = new Map(
    tracked
      .filter((r) => r.projectId)
      .map((r) => [r.projectId!, Math.round(Number(r.totalMinutes) || 0)]),
  );

  return rows.map((p) => ({
    ...p,
    trackedMinutes: minutesByProject.get(p.id) ?? 0,
  }));
}

export async function listActiveProjects(): Promise<
  { id: string; name: string }[]
> {
  const rows = await listProjects();
  return rows
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }));
}

export async function createProjectAction(input: {
  name: string;
  description?: string;
}) {
  const { userId } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name required");
  const now = new Date();
  await db.insert(projects).values({
    userId,
    name,
    description: input.description?.trim() || null,
    status: "active",
    createdAt: now,
  });
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function updateProjectAction(input: {
  id: string;
  name: string;
  description?: string | null;
  status: "active" | "paused" | "retired";
  retiredReason?: string;
}) {
  const { userId } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name required");
  if (input.status === "retired" && !input.retiredReason?.trim()) {
    throw new Error("Retirement reason is required");
  }
  const now = new Date();
  await db
    .update(projects)
    .set({
      name,
      description: input.description?.trim() || null,
      status: input.status,
      completedAt: null,
      retiredReason:
        input.status === "retired" ? input.retiredReason?.trim() ?? null : null,
      retiredAt: input.status === "retired" ? now : null,
    })
    .where(and(eq(projects.id, input.id), eq(projects.userId, userId)));
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/stats");
}

export async function completeProjectAction(id: string) {
  const { userId } = await requireUser();
  const now = new Date();
  await db
    .update(projects)
    .set({
      status: "completed",
      completedAt: now,
      retiredAt: null,
      retiredReason: null,
    })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/stats");
}

export async function getStaleProjects() {
  const { userId } = await requireUser();
  const cutoff = subDays(new Date(), 14);
  const active = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.userId, userId), eq(projects.status, "active")),
    );

  const lastByProject = await db
    .select({
      projectId: timeBlocks.projectId,
      lastAt: max(timeBlocks.endAt),
    })
    .from(timeBlocks)
    .where(
      and(eq(timeBlocks.userId, userId), isNotNull(timeBlocks.projectId)),
    )
    .groupBy(timeBlocks.projectId);

  const lastMap = new Map(
    lastByProject
      .filter((r) => r.projectId)
      .map((r) => [r.projectId!, r.lastAt]),
  );

  return active
    .map((p) => {
      const last = lastMap.get(p.id);
      const lastDate = last ? new Date(last) : null;
      const stale =
        !lastDate || lastDate < cutoff;
      const daysSince = lastDate
        ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
        : null;
      return { project: p, stale, daysSince };
    })
    .filter((x) => x.stale);
}

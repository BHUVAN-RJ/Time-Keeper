import { Suspense } from "react";
import { listHabitsForManage } from "@/actions/habits";
import { getTasksPageData } from "@/actions/tasks";
import { PageLoadingShell } from "@/components/page-loading-shell";
import {
  TasksHubClient,
  type TasksHubView,
} from "@/components/tasks-hub-client";

function parseView(raw: string | undefined): TasksHubView {
  if (raw === "habits" || raw === "projects") return raw;
  return "tasks";
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const initialView = parseView(sp.view);
  const [tasksInitial, habitsInitial] = await Promise.all([
    getTasksPageData(),
    listHabitsForManage(),
  ]);

  return (
    <Suspense fallback={<PageLoadingShell title="Tasks" rows={6} />}>
      <TasksHubClient
        tasksInitial={tasksInitial}
        habitsInitial={habitsInitial}
        initialView={initialView}
      />
    </Suspense>
  );
}

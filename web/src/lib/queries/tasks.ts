import { getTasksPageData } from "@/actions/tasks";

export type TasksPageData = Awaited<ReturnType<typeof getTasksPageData>>;

export async function fetchTasksPageData(): Promise<TasksPageData> {
  return getTasksPageData();
}

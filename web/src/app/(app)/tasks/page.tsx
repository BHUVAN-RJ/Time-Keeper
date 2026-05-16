import { getTasksPageData } from "@/actions/tasks";
import { TasksClient } from "@/components/tasks-client";

export default async function TasksPage() {
  const initial = await getTasksPageData();
  return <TasksClient initial={initial} />;
}

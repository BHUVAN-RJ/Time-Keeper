"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { listHabitsForManage } from "@/actions/habits";
import { HabitsClient } from "@/components/habits-client";
import { ProjectsClient } from "@/components/projects-client";
import { TasksClient } from "@/components/tasks-client";

export type TasksHubView = "tasks" | "habits" | "projects";

const VIEWS: { id: TasksHubView; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "habits", label: "Habits" },
  { id: "projects", label: "Projects" },
];

function parseView(raw: string | null | undefined): TasksHubView {
  if (raw === "habits" || raw === "projects") return raw;
  return "tasks";
}

export function TasksHubClient({
  tasksInitial,
  habitsInitial,
  initialView,
}: {
  tasksInitial: Awaited<
    ReturnType<typeof import("@/actions/tasks").getTasksPageData>
  >;
  habitsInitial: Awaited<ReturnType<typeof listHabitsForManage>>;
  initialView: TasksHubView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view") ?? initialView);

  function setView(next: TasksHubView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "tasks") params.delete("view");
    else params.set("view", next);
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex gap-1 rounded-xl border border-tk-line bg-tk-surface-2 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
              view === v.id
                ? "bg-tk-surface text-tk-ink shadow-sm"
                : "text-tk-ink-3 hover:text-tk-ink-2"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "tasks" ? <TasksClient initial={tasksInitial} embedded /> : null}
      {view === "habits" ? <HabitsClient initial={habitsInitial} embedded /> : null}
      {view === "projects" ? <ProjectsClient embedded /> : null}
    </div>
  );
}

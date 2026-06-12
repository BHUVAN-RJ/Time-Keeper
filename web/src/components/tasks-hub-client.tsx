"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { listHabitsForManage } from "@/actions/habits";
import { HabitsClient } from "@/components/habits-client";
import { ProjectsClient } from "@/components/projects-client";
import { TasksClient } from "@/components/tasks-client";
import type { TasksPageData } from "@/lib/queries/tasks";

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
  tasksInitial: TasksPageData;
  habitsInitial: Awaited<ReturnType<typeof listHabitsForManage>>;
  initialView: TasksHubView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlView = parseView(searchParams.get("view") ?? initialView);
  const [view, setViewState] = useState<TasksHubView>(urlView);

  const setView = useCallback(
    (next: TasksHubView) => {
      setViewState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "tasks") params.delete("view");
      else params.set("view", next);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const activeView = view;

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex gap-1 rounded-xl border border-tk-line bg-tk-surface-2 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
              activeView === v.id
                ? "bg-tk-surface text-tk-ink shadow-sm"
                : "text-tk-ink-3 hover:text-tk-ink-2"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView === "tasks" ? (
        <TasksClient initialData={tasksInitial} embedded />
      ) : null}
      {activeView === "habits" ? (
        <HabitsClient initialData={habitsInitial} embedded active />
      ) : null}
      {activeView === "projects" ? (
        <ProjectsClient embedded />
      ) : null}
    </div>
  );
}

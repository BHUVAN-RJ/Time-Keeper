"use client";

import type { AllocationType } from "@/components/allocation-picker-types";

type Project = { id: string; name: string };
type Habit = { id: string; name: string };
type Task = { id: string; title: string };

export function AllocationPicker({
  type,
  entityId,
  onChange,
  projects,
  habits,
  tasks,
  disabled,
}: {
  type: AllocationType;
  entityId: string;
  onChange: (type: AllocationType, entityId: string) => void;
  projects: Project[];
  habits: Habit[];
  tasks: Task[];
  disabled?: boolean;
}) {
  const options =
    type === "project"
      ? projects.map((p) => ({ id: p.id, label: p.name }))
      : type === "habit"
        ? habits.map((h) => ({ id: h.id, label: h.name }))
        : type === "task"
          ? tasks.map((t) => ({ id: t.id, label: t.title }))
          : [];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[12px] text-tk-ink-2">
        Allocate time to
        <select
          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          value={type ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value as AllocationType | "";
            onChange(v === "" ? null : v, "");
          }}
        >
          <option value="">None</option>
          <option value="project">Project</option>
          <option value="habit">Habit</option>
          <option value="task">Task</option>
        </select>
      </label>
      {type ? (
        <label className="text-[12px] text-tk-ink-2">
          {type === "project"
            ? "Project"
            : type === "habit"
              ? "Habit"
              : "Task"}
          <select
            className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={entityId}
            disabled={disabled}
            onChange={(e) => onChange(type, e.target.value)}
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {options.length === 0 ? (
            <p className="mt-1 text-[11px] text-tk-ink-4">
              No {type}s yet — create one in Tasks, Habits, or Projects.
            </p>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}

export function allocationToFields(
  type: AllocationType,
  entityId: string,
): {
  projectId: string | null;
  habitId: string | null;
  taskId: string | null;
} {
  if (!type || !entityId) {
    return { projectId: null, habitId: null, taskId: null };
  }
  if (type === "project") {
    return { projectId: entityId, habitId: null, taskId: null };
  }
  if (type === "habit") {
    return { projectId: null, habitId: entityId, taskId: null };
  }
  return { projectId: null, habitId: null, taskId: entityId };
}

export function fieldsToAllocation(block: {
  projectId?: string | null;
  habitId?: string | null;
  taskId?: string | null;
}): { type: AllocationType; entityId: string } {
  if (block.projectId) {
    return { type: "project", entityId: block.projectId };
  }
  if (block.habitId) {
    return { type: "habit", entityId: block.habitId };
  }
  if (block.taskId) {
    return { type: "task", entityId: block.taskId };
  }
  return { type: null, entityId: "" };
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { TaskRow } from "@/actions/tasks";
import { EisenhowerBoard } from "@/components/eisenhower-board";
import { ProjectPicker } from "@/components/project-picker";
import { TagPicker } from "@/components/tag-picker";
import { adjustedEstimateMinutes } from "@/lib/estimate-accuracy";
import {
  QUADRANT_META,
  QUADRANTS,
  eisenhowerQuadrant,
} from "@/lib/eisenhower";
import {
  useCompleteTaskMutation,
  useCreateTaskMutation,
  useDropTaskMutation,
  useScheduleForTodayMutation,
  useUpdateTaskMutation,
} from "@/lib/mutations/use-task-mutations";
import { queryKeys } from "@/lib/queries/keys";
import {
  fetchTasksPageData,
  type TasksPageData,
} from "@/lib/queries/tasks";

type Tab = "today" | "remaining" | "backlog" | "matrix";

function TaskCard({
  task,
  today,
  tagsEnabled,
}: {
  task: TaskRow;
  today: string;
  tagsEnabled: boolean;
}) {
  const complete = useCompleteTaskMutation();
  const schedule = useScheduleForTodayMutation();
  const drop = useDropTaskMutation();
  const update = useUpdateTaskMutation();

  const [dropOpen, setDropOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editEstimate, setEditEstimate] = useState(String(task.estimateMinutes));
  const [editScheduled, setEditScheduled] = useState(task.scheduledDate ?? "");
  const [editDue, setEditDue] = useState(task.dueDate ?? "");

  const pendingId =
    (complete.isPending && complete.variables?.taskId) ||
    (schedule.isPending && schedule.variables?.taskId) ||
    (drop.isPending && drop.variables?.taskId) ||
    (update.isPending && update.variables?.taskId) ||
    null;

  const isBusy = pendingId === task.id;

  function openEdit() {
    setEditTitle(task.title);
    setEditEstimate(String(task.estimateMinutes));
    setEditScheduled(task.scheduledDate ?? "");
    setEditDue(task.dueDate ?? "");
    setEditOpen(true);
  }

  const quadrant = eisenhowerQuadrant(task.urgency, task.importance);
  const quadrantCode = QUADRANT_META[quadrant].code;

  return (
    <li className="card flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-medium ${task.status === "completed" ? "text-tk-ink-3 line-through" : "text-tk-ink"}`}
            >
              {task.title}
            </span>
            <span className="rounded-md bg-tk-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-tk-ink-3">
              {quadrantCode}
            </span>
            {task.rescheduleCount >= 3 ? (
              <span className="text-[10px] text-tk-warn">
                ↻ {task.rescheduleCount}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] text-tk-ink-3">
            {task.estimateMinutes}m est
            {task.categoryName ? (
              <>
                {" "}
                ·{" "}
                <span style={{ color: task.categoryColor ?? undefined }}>
                  {task.categoryName}
                </span>
              </>
            ) : null}
            {task.projectName ? ` · ${task.projectName}` : null}
            {task.dueDate ? ` · due ${task.dueDate}` : null}
            {task.scheduledDate ? ` · sched ${task.scheduledDate}` : null}
          </p>
          {tagsEnabled && task.tags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-md bg-tk-surface-2 px-1.5 py-0.5 text-[10px] text-tk-ink-3"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy && complete.isPending}
          className="btn-primary px-3 py-1.5 text-[12px]"
          onClick={() => {
            complete.mutate(
              { taskId: task.id },
              {
                onSuccess: (res) => {
                  if (res?.showScoreToast) {
                    toast.success(
                      `Score: ${res.scoreAfter} (+${res.scoreDelta})`,
                      { duration: 3000 },
                    );
                  } else {
                    toast.success("Completed");
                  }
                },
              },
            );
          }}
        >
          Done
        </button>
        {task.scheduledDate !== today && task.status !== "in_progress" ? (
          <button
            type="button"
            disabled={isBusy && schedule.isPending}
            className="btn-ghost px-3 py-1.5 text-[12px]"
            onClick={() =>
              schedule.mutate(
                { taskId: task.id },
                { onSuccess: () => toast.success("Scheduled for today") },
              )
            }
          >
            Today
          </button>
        ) : null}
        <button
          type="button"
          disabled={isBusy}
          className="btn-ghost px-3 py-1.5 text-[12px]"
          onClick={openEdit}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isBusy}
          className="btn-ghost px-3 py-1.5 text-[12px] text-tk-warn"
          onClick={() => setDropOpen((v) => !v)}
        >
          Drop
        </button>
      </div>
      {editOpen ? (
        <div className="flex flex-col gap-2 border-t border-tk-line pt-2">
          <label className="text-[11px] text-tk-ink-3">
            Title
            <input
              className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 text-[11px] text-tk-ink-3">
              Estimate (min)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
                value={editEstimate}
                onChange={(e) => setEditEstimate(e.target.value)}
              />
            </label>
            <label className="flex-1 text-[11px] text-tk-ink-3">
              Scheduled
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
                value={editScheduled}
                onChange={(e) => setEditScheduled(e.target.value)}
              />
            </label>
            <label className="flex-1 text-[11px] text-tk-ink-3">
              Due
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
                value={editDue}
                onChange={(e) => setEditDue(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy && update.isPending}
              className="btn-primary px-3 py-1.5 text-[12px]"
              onClick={() =>
                update.mutate(
                  {
                    taskId: task.id,
                    fields: {
                      title: editTitle,
                      estimateMinutes: Number.parseInt(editEstimate, 10),
                      scheduledDate: editScheduled || null,
                      dueDate: editDue || null,
                    },
                  },
                  {
                    onSuccess: () => {
                      setEditOpen(false);
                      toast.success("Task updated");
                    },
                  },
                )
              }
            >
              Save
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-[12px]"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {dropOpen ? (
        <div className="flex flex-col gap-2 border-t border-tk-line pt-2">
          <input
            className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
            placeholder="Why are you dropping this?"
            value={dropReason}
            onChange={(e) => setDropReason(e.target.value)}
          />
          <button
            type="button"
            disabled={(isBusy && drop.isPending) || !dropReason.trim()}
            className="btn-ghost self-start px-3 py-1.5 text-[12px] text-tk-warn"
            onClick={() =>
              drop.mutate(
                { taskId: task.id, reason: dropReason },
                {
                  onSuccess: () => {
                    setDropOpen(false);
                    setDropReason("");
                    toast.success("Dropped");
                  },
                },
              )
            }
          >
            Confirm drop
          </button>
        </div>
      ) : null}
    </li>
  );
}

function TaskTabs({
  tab,
  onTab,
  isFetching,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  isFetching?: boolean;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "remaining", label: "Remaining" },
    { id: "backlog", label: "Backlog" },
    { id: "matrix", label: "Matrix" },
  ];
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1 rounded-xl border border-tk-line bg-tk-surface-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
              tab === t.id
                ? "bg-tk-surface text-tk-ink shadow-sm"
                : "text-tk-ink-3 hover:text-tk-ink-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isFetching ? (
        <span className="text-[10px] text-tk-ink-4" aria-live="polite">
          Syncing…
        </span>
      ) : null}
    </div>
  );
}

export function TasksClient({
  initialData,
  embedded = false,
}: {
  initialData: TasksPageData;
  embedded?: boolean;
}) {
  const qc = useQueryClient();
  const { data = initialData, isFetching } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: fetchTasksPageData,
    initialData,
    staleTime: 30_000,
  });

  const createTask = useCreateTaskMutation();

  const [tab, setTab] = useState<Tab>("today");
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("30");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState(data.today);
  const [createTagIds, setCreateTagIds] = useState<string[]>([]);

  const hint = data.estimateHint;
  const estNum = Number(estimate) || 0;
  const likelyMinutes =
    hint && estNum > 0
      ? adjustedEstimateMinutes(estNum, hint.multiplier)
      : null;

  const matrixTasks = useMemo(
    () => QUADRANTS.flatMap((q) => data.matrixByQuadrant[q]),
    [data.matrixByQuadrant],
  );

  function resetCreateForm() {
    setTitle("");
    setEstimate("30");
    setDueDate("");
    setCreateTagIds([]);
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate(
      {
        title: title.trim(),
        estimateMinutes: Number(estimate) || 0,
        categoryId: categoryId || null,
        projectId: projectId || null,
        dueDate: dueDate || null,
        scheduledDate: scheduledDate || null,
        tagIds: createTagIds,
        onFormReset: resetCreateForm,
      },
      {
        onSuccess: () => toast.success("Task created"),
      },
    );
  }

  function invalidateTasks() {
    void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
  }

  return (
    <div className={`flex flex-col gap-6 ${embedded ? "" : "py-2"}`}>
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Tasks</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          Today is {data.today}. Use Matrix to prioritize by urgency and
          importance.
        </p>
      </div>

      <TaskTabs tab={tab} onTab={setTab} isFetching={isFetching} />

      <form onSubmit={onCreate} className="card flex flex-col gap-3 p-4">
        <div className="eyebrow">New task</div>
        <input
          className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Estimate (min)
            <input
              type="number"
              min={1}
              className="mt-1 w-24 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
            {likelyMinutes != null ? (
              <span className="mt-1 text-[11px] text-tk-honey">
                {estNum} min → likely {likelyMinutes} min from your history
              </span>
            ) : null}
          </label>
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Category
            <select
              className="mt-1 min-w-[140px] rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <ProjectPicker
            projects={data.activeProjects}
            value={projectId}
            onChange={setProjectId}
            className="min-w-[140px]"
          />
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Due
            <input
              type="date"
              className="mt-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Scheduled
            <input
              type="date"
              className="mt-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </label>
        </div>
        {data.tagsEnabled ? (
          <TagPicker
            allTags={data.allTags}
            selectedIds={createTagIds}
            onChange={setCreateTagIds}
            onTagsChange={invalidateTasks}
          />
        ) : null}
        <button
          type="submit"
          disabled={createTask.isPending}
          className="btn-primary self-start"
        >
          Add task
        </button>
      </form>

      {tab === "matrix" ? (
        <EisenhowerBoard
          key={JSON.stringify(data.matrixLayout)}
          tasks={matrixTasks}
          initialLayout={data.matrixLayout}
          onSaved={invalidateTasks}
        />
      ) : null}

      {tab === "today" ? (
        <section>
          <h2 className="eyebrow mb-2">Today</h2>
          {data.todayTasks.length === 0 ? (
            <p className="text-[13px] text-tk-ink-3">
              Nothing scheduled for today yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.todayTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  today={data.today}
                  tagsEnabled={data.tagsEnabled}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "remaining" ? (
        <section>
          <h2 className="eyebrow mb-2">Remaining tasks</h2>
          {data.remainingTasks.length === 0 ? (
            <p className="text-[13px] text-tk-ink-3">No open tasks. All clear.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.remainingTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  today={data.today}
                  tagsEnabled={data.tagsEnabled}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "backlog" ? (
        <section>
          <h2 className="eyebrow mb-2">Backlog</h2>
          {data.backlogTasks.length === 0 ? (
            <p className="text-[13px] text-tk-ink-3">Backlog is empty.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.backlogTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  today={data.today}
                  tagsEnabled={data.tagsEnabled}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

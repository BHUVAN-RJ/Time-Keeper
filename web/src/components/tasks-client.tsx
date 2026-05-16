"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  completeTaskAction,
  createTaskAction,
  dropTaskAction,
  type TaskRow,
  scheduleTaskForTodayAction,
} from "@/actions/tasks";

type CategoryOption = { id: string; name: string; color: string };

function eisenhowerQuadrant(urgency: number, importance: number) {
  if (urgency <= 2 && importance <= 2) return "Q1";
  if (urgency > 2 && importance <= 2) return "Q2";
  if (urgency <= 2 && importance > 2) return "Q3";
  return "Q4";
}

function TaskCard({
  task,
  today,
  onRefresh,
}: {
  task: TaskRow;
  today: string;
  onRefresh: () => Promise<void>;
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const quadrant = eisenhowerQuadrant(task.urgency, task.importance);

  return (
    <li className="card flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-tk-ink">{task.title}</span>
            <span className="rounded-md bg-tk-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-tk-ink-3">
              {quadrant}
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
            {task.dueDate ? ` · due ${task.dueDate}` : null}
            {task.scheduledDate ? ` · sched ${task.scheduledDate}` : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn-primary px-3 py-1.5 text-[12px]"
          onClick={() =>
            run(async () => {
              const res = await completeTaskAction(task.id);
              if (res?.showScoreToast) {
                toast.success(`Score: ${res.scoreAfter} (+${res.scoreDelta})`, {
                  duration: 3000,
                });
              } else if (res) {
                toast.success("Completed");
              } else {
                toast.success("Completed");
              }
            })
          }
        >
          Done
        </button>
        {task.scheduledDate !== today && task.status !== "in_progress" ? (
          <button
            type="button"
            disabled={busy}
            className="btn-ghost px-3 py-1.5 text-[12px]"
            onClick={() =>
              run(async () => {
                await scheduleTaskForTodayAction(task.id);
                toast.success("Scheduled for today");
              })
            }
          >
            Today
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="btn-ghost px-3 py-1.5 text-[12px] text-tk-warn"
          onClick={() => setDropOpen((v) => !v)}
        >
          Drop
        </button>
      </div>
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
            disabled={busy || !dropReason.trim()}
            className="btn-ghost self-start px-3 py-1.5 text-[12px] text-tk-warn"
            onClick={() =>
              run(async () => {
                await dropTaskAction(task.id, dropReason);
                setDropOpen(false);
                setDropReason("");
                toast.success("Dropped");
              })
            }
          >
            Confirm drop
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function TasksClient({
  initial,
}: {
  initial: {
    today: string;
    todayTasks: TaskRow[];
    backlogTasks: TaskRow[];
    categories: CategoryOption[];
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("30");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState(initial.today);
  const [pending, setPending] = useState(false);

  async function refresh() {
    router.refresh();
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      await createTaskAction({
        title: title.trim(),
        estimateMinutes: Number(estimate) || 0,
        categoryId: categoryId || null,
        dueDate: dueDate || null,
        scheduledDate: scheduledDate || null,
      });
      setTitle("");
      setEstimate("30");
      setDueDate("");
      toast.success("Task created");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Tasks</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          v0.2 — estimate required. Today is {initial.today}.
        </p>
      </div>

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
          </label>
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Category
            <select
              className="mt-1 min-w-[140px] rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {initial.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
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
        <button type="submit" disabled={pending} className="btn-primary self-start">
          Add task
        </button>
      </form>

      <section>
        <h2 className="eyebrow mb-2">Today</h2>
        {initial.todayTasks.length === 0 ? (
          <p className="text-[13px] text-tk-ink-3">Nothing scheduled for today yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {initial.todayTasks.map((t) => (
              <TaskCard key={t.id} task={t} today={initial.today} onRefresh={refresh} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="eyebrow mb-2">Backlog</h2>
        {initial.backlogTasks.length === 0 ? (
          <p className="text-[13px] text-tk-ink-3">Backlog is empty.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {initial.backlogTasks.map((t) => (
              <TaskCard key={t.id} task={t} today={initial.today} onRefresh={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

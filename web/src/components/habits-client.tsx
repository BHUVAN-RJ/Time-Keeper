"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  archiveHabitAction,
  createHabitAction,
  updateHabitAction,
} from "@/actions/habits";
import { PageLoadingShell } from "@/components/page-loading-shell";
import type { HabitDayCell } from "@/lib/habits-compute";
import { queryKeys } from "@/lib/queries/keys";
import {
  fetchHabitsManage,
  type HabitsManageData,
} from "@/lib/queries/habits";
import { createTempId } from "@/lib/temp-id";

type Row = HabitsManageData["rows"][number];

function cellClass(cell: HabitDayCell): string {
  if (cell.offDaySkipped) return "bg-tk-ink-4/50 ring-1 ring-tk-line-strong";
  if (cell.freezeUsed) return "bg-sky-900/50 ring-1 ring-sky-600/40";
  if (cell.hit) return "bg-tk-green/80";
  if (cell.count > 0) return "bg-tk-honey/40";
  return "bg-tk-line/60";
}

function cellTitle(cell: HabitDayCell): string {
  if (cell.offDaySkipped) return `${cell.date}: off day (rest)`;
  if (cell.freezeUsed) return `${cell.date}: freeze used`;
  if (cell.hit) return `${cell.date}: hit (${cell.count}/${cell.target})`;
  if (cell.count > 0) return `${cell.date}: ${cell.count}/${cell.target}`;
  return `${cell.date}: missed`;
}

export function HabitsClient({
  initialData,
  embedded = false,
  active = true,
}: {
  initialData?: HabitsManageData;
  embedded?: boolean;
  active?: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.habits.manage,
    queryFn: fetchHabitsManage,
    initialData,
    enabled: active,
    staleTime: 30_000,
  });

  const [name, setName] = useState("");
  const [target, setTarget] = useState("1");

  const createHabit = useMutation({
    mutationFn: (input: { name: string; targetPerDay: number }) =>
      createHabitAction(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.habits.manage });
      const previous = qc.getQueryData<HabitsManageData>(queryKeys.habits.manage);
      setName("");
      setTarget("1");
      if (previous) {
        const tempId = createTempId();
        const optimisticRow: Row = {
          habit: {
            id: tempId,
            userId: "",
            name: input.name,
            description: null,
            targetPerDay: input.targetPerDay,
            categoryId: null,
            active: true,
            archivedAt: null,
            createdAt: new Date(),
          },
          streak: {
            id: createTempId(),
            habitId: tempId,
            currentStreak: 0,
            longestStreak: 0,
            daysHitLast30: 0,
            lastCompletedDate: null,
            freezesAvailable: 2,
            freezesUsedThisMonth: 0,
            freezeMonthKey: null,
            updatedAt: new Date(),
          },
          heatmap: [],
        };
        qc.setQueryData<HabitsManageData>(queryKeys.habits.manage, {
          ...previous,
          rows: [optimisticRow, ...previous.rows],
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.habits.manage, ctx.previous);
      }
      toast.error("Could not create habit");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.habits.manage });
      void qc.invalidateQueries({ queryKey: queryKeys.today.all });
    },
    onSuccess: () => toast.success("Habit created"),
  });

  if (isLoading && !data) {
    return <PageLoadingShell title="Habits" rows={4} />;
  }

  if (isError || !data) {
    return (
      <p className="text-center text-[13px] text-tk-ink-3">
        Could not load habits.
      </p>
    );
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createHabit.mutate({
      name: name.trim(),
      targetPerDay: Number(target) || 1,
    });
  }

  return (
    <div className={`flex flex-col gap-6 ${embedded ? "" : "py-2"}`}>
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Habits</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          <span className="font-medium text-tk-ink-2">Days hit (30d)</span> is
          the headline metric — not consecutive streaks.
        </p>
      </div>

      <form onSubmit={onCreate} className="card flex flex-col gap-3 p-4">
        <div className="eyebrow">New habit</div>
        <input
          className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="flex flex-col gap-1 text-[12px] text-tk-ink-3">
          Target per day
          <input
            type="number"
            min={1}
            max={99}
            className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="btn-primary py-2.5 text-[14px]"
          disabled={createHabit.isPending}
        >
          Add habit
        </button>
      </form>

      {data.rows.length === 0 ? (
        <p className="text-center text-[13px] text-tk-ink-3">
          No habits yet. Add one above — they show on Today.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.rows.map((row) => (
            <HabitRowCard key={row.habit.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HabitRowCard({ row }: { row: Row }) {
  const qc = useQueryClient();
  const { habit, streak, heatmap } = row;
  const [editName, setEditName] = useState(habit.name);
  const [editTarget, setEditTarget] = useState(String(habit.targetPerDay));

  const update = useMutation({
    mutationFn: () =>
      updateHabitAction(habit.id, {
        name: editName,
        targetPerDay: Number(editTarget) || 1,
        active: habit.active,
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.habits.manage });
      const previous = qc.getQueryData<HabitsManageData>(queryKeys.habits.manage);
      if (previous) {
        qc.setQueryData<HabitsManageData>(queryKeys.habits.manage, {
          ...previous,
          rows: previous.rows.map((r) =>
            r.habit.id === habit.id
              ? {
                  ...r,
                  habit: {
                    ...r.habit,
                    name: editName,
                    targetPerDay: Number(editTarget) || 1,
                  },
                }
              : r,
          ),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.habits.manage, ctx.previous);
      toast.error("Could not save habit");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.habits.manage });
    },
    onSuccess: () => toast.success("Saved"),
  });

  const archive = useMutation({
    mutationFn: () => archiveHabitAction(habit.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.habits.manage });
      const previous = qc.getQueryData<HabitsManageData>(queryKeys.habits.manage);
      if (previous) {
        qc.setQueryData<HabitsManageData>(queryKeys.habits.manage, {
          ...previous,
          rows: previous.rows.filter((r) => r.habit.id !== habit.id),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.habits.manage, ctx.previous);
      toast.error("Could not archive habit");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.habits.manage });
      void qc.invalidateQueries({ queryKey: queryKeys.today.all });
    },
    onSuccess: () => toast.success("Archived"),
  });

  return (
    <li className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="eyebrow">{habit.active ? "Active" : "Paused"}</div>
        <div className="text-[11px] text-tk-ink-3">
          {streak.daysHitLast30}/30d · streak {streak.currentStreak} ·{" "}
          {streak.freezesAvailable} ❄
        </div>
      </div>
      <input
        className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
      />
      <label className="flex flex-col gap-1 text-[12px] text-tk-ink-3">
        Target / day
        <input
          type="number"
          min={1}
          max={99}
          className="w-24 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          value={editTarget}
          onChange={(e) => setEditTarget(e.target.value)}
        />
      </label>

      <HabitHeatmap heatmap={heatmap} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary px-4 py-2 text-[13px]"
          disabled={update.isPending}
          onClick={() => update.mutate()}
        >
          Save
        </button>
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-[13px] text-tk-red"
          onClick={() => {
            if (confirm(`Archive "${habit.name}"?`)) archive.mutate();
          }}
        >
          Archive
        </button>
      </div>
    </li>
  );
}

function HabitHeatmap({ heatmap }: { heatmap: HabitDayCell[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-tk-ink-4">
        Last 14 days
      </div>
      <div className="flex gap-0.5">
        {heatmap.map((cell) => (
          <HeatmapCell key={cell.date} cell={cell} />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-tk-ink-4">
        Green = hit · Amber = partial · ❄ = freeze · ☁ = off day
      </p>
    </div>
  );
}

function HeatmapCell({ cell }: { cell: HabitDayCell }) {
  return (
    <div
      title={cellTitle(cell)}
      className={`h-6 w-4 shrink-0 rounded-sm ${cellClass(cell)}`}
    >
      {cell.offDaySkipped ? (
        <span className="flex h-full items-center justify-center text-[8px]">
          ☁
        </span>
      ) : cell.freezeUsed ? (
        <span className="flex h-full items-center justify-center text-[8px]">
          ❄
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/actions/categories";
import { upsertScheduleGoalAction } from "@/actions/schedule-goals";
import { categories } from "@/db/schema";

type Category = typeof categories.$inferSelect;

type ScheduleGoal = {
  id: string;
  categoryId: string;
  categoryName: string;
  color: string;
  targetMinutesPerDay: number;
};

export function CategoriesClient({
  initial,
  scheduleGoals,
}: {
  initial: Category[];
  scheduleGoals: ScheduleGoal[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("10");
  const [color, setColor] = useState("#8a8167");
  const [free, setFree] = useState(false);
  const [pending, setPending] = useState(false);

  async function refresh() {
    router.refresh();
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      await createCategoryAction({
        name: name.trim(),
        baseCreditRate: Number(rate) || 0,
        color,
        isFreeTime: free,
      });
      setName("");
      setRate("10");
      setColor("#8a8167");
      setFree(false);
      toast.success("Category created");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleArchive(row: Category) {
    const res = await updateCategoryAction(row.id, {
      name: row.name,
      baseCreditRate: row.baseCreditRate,
      color: row.color,
      isFreeTime: row.isFreeTime,
      archived: !row.archived,
    });
    if (!res.ok && res.code === "HAS_BLOCKS") {
      toast.error("Archive blocked: reassign or delete time blocks first.");
      return;
    }
    toast.success(row.archived ? "Restored" : "Archived");
    await refresh();
  }

  async function patchField(
    row: Category,
    patch: Partial<
      Pick<Category, "name" | "baseCreditRate" | "color" | "isFreeTime">
    >,
  ) {
    await updateCategoryAction(row.id, {
      name: patch.name ?? row.name,
      baseCreditRate: patch.baseCreditRate ?? row.baseCreditRate,
      color: patch.color ?? row.color,
      isFreeTime: patch.isFreeTime ?? row.isFreeTime,
      archived: row.archived,
    });
    toast.success("Saved");
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Categories</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          Credit rate is minutes earned per hour tracked (spec §5.2).
        </p>
      </div>

      {scheduleGoals.length > 0 ? (
        <section className="card flex flex-col gap-3 p-4">
          <div className="eyebrow">Daily schedule goals (minutes)</div>
          <p className="text-[12px] text-tk-ink-3">
            Drives goal hit %, red-day signal, and End Day credits.
          </p>
          {scheduleGoals.map((g) => (
            <ScheduleGoalRow key={g.id} goal={g} onSaved={refresh} />
          ))}
        </section>
      ) : null}

      <form onSubmit={onCreate} className="card flex flex-col gap-3 p-4">
        <div className="eyebrow">New category</div>
        <input
          className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Rate (min/hr)
            <input
              type="number"
              step="0.5"
              className="mt-1 w-28 rounded-xl border border-tk-line bg-tk-surface-2 px-2 py-2 text-tk-ink"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Color
            <input
              type="color"
              className="mt-1 h-10 w-16 cursor-pointer rounded border border-tk-line bg-transparent"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label className="mt-5 flex items-center gap-2 text-[13px] text-tk-ink-2">
            <input
              type="checkbox"
              checked={free}
              onChange={(e) => setFree(e.target.checked)}
            />
            Free time (spends credits)
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary py-2 text-[14px] disabled:opacity-50"
        >
          Add category
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {initial.map((row) => (
          <CategoryRow
            key={`${row.id}:${row.name}:${row.baseCreditRate}:${row.color}:${String(row.isFreeTime)}:${String(row.archived)}`}
            row={row}
            onArchive={() => void toggleArchive(row)}
            onPatch={(p) => void patchField(row, p)}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleGoalRow({
  goal,
  onSaved,
}: {
  goal: ScheduleGoal;
  onSaved: () => Promise<void>;
}) {
  const [mins, setMins] = useState(String(goal.targetMinutesPerDay));
  return (
    <label className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-2 text-tk-ink">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: goal.color }}
        />
        {goal.categoryName}
      </span>
      <input
        type="number"
        min={0}
        className="w-20 rounded-xl border border-tk-line bg-tk-surface-2 px-2 py-1 text-right text-tk-ink"
        value={mins}
        onChange={(e) => setMins(e.target.value)}
        onBlur={async () => {
          await upsertScheduleGoalAction({
            categoryId: goal.categoryId,
            targetMinutesPerDay: Number(mins) || 0,
          });
          await onSaved();
        }}
      />
    </label>
  );
}

function CategoryRow({
  row,
  onArchive,
  onPatch,
}: {
  row: Category;
  onArchive: () => void;
  onPatch: (
    p: Partial<Pick<Category, "name" | "baseCreditRate" | "color" | "isFreeTime">>,
  ) => void;
}) {
  const [name, setName] = useState(row.name);
  const [rate, setRate] = useState(String(row.baseCreditRate));
  const [color, setColor] = useState(row.color);
  const [free, setFree] = useState(row.isFreeTime);

  return (
    <div
      className={`card flex flex-col gap-3 p-4 ${row.archived ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: row.color }}
        />
        {row.archived ? (
          <span className="chip-red text-[10px]">Archived</span>
        ) : null}
        {row.isFreeTime ? (
          <span className="chip-honey text-[10px]">Free time</span>
        ) : null}
      </div>
      <input
        className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name !== row.name) onPatch({ name });
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[11px] text-tk-ink-3">
          Rate
          <input
            type="number"
            step="0.5"
            className="ml-2 w-24 rounded-xl border border-tk-line bg-tk-surface-2 px-2 py-1 text-tk-ink"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => {
              const n = Number(rate);
              if (n !== row.baseCreditRate) onPatch({ baseCreditRate: n });
            }}
          />
        </label>
        <input
          type="color"
          className="h-9 w-14 cursor-pointer rounded border border-tk-line"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => {
            if (color !== row.color) onPatch({ color });
          }}
        />
        <label className="flex items-center gap-2 text-[12px] text-tk-ink-2">
          <input
            type="checkbox"
            checked={free}
            onChange={(e) => {
              const v = e.target.checked;
              setFree(v);
              onPatch({ isFreeTime: v });
            }}
          />
          Free time
        </label>
      </div>
      <button
        type="button"
        className="btn-ghost self-start py-2 text-[13px]"
        onClick={onArchive}
      >
        {row.archived ? "Restore" : "Archive"}
      </button>
    </div>
  );
}

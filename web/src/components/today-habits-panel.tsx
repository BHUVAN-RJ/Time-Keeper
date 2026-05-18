"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { getTodayDashboardExtras } from "@/actions/today-extras";
import { incrementHabitTodayAction } from "@/actions/habits";

type Extras = Awaited<ReturnType<typeof getTodayDashboardExtras>>;
type HabitRow = Extras["habits"][number];

export function TodayHabitsPanel({
  habits: initialHabits,
  isOffDay,
  isVacation = false,
}: {
  habits: Extras["habits"];
  isOffDay: boolean;
  isVacation?: boolean;
}) {
  const [patches, setPatches] = useState<Record<string, Partial<HabitRow>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const habitsKey = initialHabits
    .map((h) => `${h.id}:${h.todayCount}:${h.todayHit}`)
    .join("|");
  const [prevHabitsKey, setPrevHabitsKey] = useState(habitsKey);
  if (habitsKey !== prevHabitsKey) {
    setPrevHabitsKey(habitsKey);
    setPatches({});
  }

  const habits = initialHabits.map((h) => ({ ...h, ...patches[h.id] }));

  if (habits.length === 0) return null;

  function patchHabit(id: string, patch: Partial<HabitRow>) {
    setPatches((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  }

  async function onIncrement(h: HabitRow) {
    if (isOffDay || isVacation || h.offDayPaused) return;

    const optimisticCount = h.todayCount + 1;
    const optimisticHit = optimisticCount >= h.targetPerDay;
    patchHabit(h.id, {
      todayCount: optimisticCount,
      todayHit: optimisticHit,
    });

    setBusyId(h.id);
    try {
      const res = await incrementHabitTodayAction(h.id);
      patchHabit(h.id, {
        todayCount: res.todayCount,
        todayHit: res.todayHit,
        streak: {
          ...h.streak,
          daysHitLast30: res.daysHitLast30,
          currentStreak: res.currentStreak,
        },
      });
    } catch (e) {
      patchHabit(h.id, {
        todayCount: h.todayCount,
        todayHit: h.todayHit,
      });
      toast.error(e instanceof Error ? e.message : "Could not update habit.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">Habits today</div>
        <Link
          href="/tasks?view=habits"
          className="text-[11px] text-tk-honey hover:underline"
        >
          Manage
        </Link>
      </div>
      {isVacation ? (
        <p className="text-[12px] text-tk-ink-3">
          Vacation — habits count as hit for today.
        </p>
      ) : isOffDay ? (
        <p className="text-[12px] text-tk-ink-3">
          Off day — habits paused. Counts as hit without using a ❄ freeze.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {habits.map((h) => {
          const paused = isOffDay || isVacation || h.offDayPaused;
          const pct = paused
            ? 100
            : Math.min(
                100,
                Math.round((h.todayCount / h.targetPerDay) * 100),
              );
          const done = h.todayHit;
          return (
            <li
              key={h.id}
              className="rounded-xl border border-tk-line bg-tk-surface-2/60 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span
                  className={`text-[15px] font-medium ${done ? "text-tk-green" : "text-tk-ink"}`}
                >
                  {h.name}
                  {paused ? (
                    <span className="ml-1.5 text-[11px] font-normal text-tk-ink-4">
                      ☁ rest
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] text-tk-ink-3">
                  {paused ? "paused" : `${h.todayCount}/${h.targetPerDay}`}
                  <span className="text-tk-ink-4"> · </span>
                  {h.streak.daysHitLast30}/30d
                  <span className="text-tk-ink-4"> · </span>
                  {h.streak.freezesAvailable} ❄
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tk-line">
                <div
                  className={`h-full rounded-full transition-all ${
                    done ? "bg-tk-green" : "bg-tk-honey"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {!paused ? (
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn-primary px-4 py-1.5 text-[12px]"
                    disabled={busyId === h.id || done}
                    onClick={() => void onIncrement(h)}
                  >
                    +1
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

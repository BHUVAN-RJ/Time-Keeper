"use client";

import type { CategoryGoalRow } from "@/lib/day-compute";

function fmtMins(m: number) {
  const h = Math.floor(m / 60);
  const mRem = Math.round(m % 60);
  if (h > 0) return `${h}h ${String(mRem).padStart(2, "0")}m`;
  return `${mRem}m`;
}

export function CategoryGoalsChart({
  goals,
  emptyMessage = "No category time logged yet.",
}: {
  goals: CategoryGoalRow[];
  emptyMessage?: string;
}) {
  if (goals.length === 0) {
    return <p className="text-[12px] text-tk-ink-3">{emptyMessage}</p>;
  }

  const maxTarget = Math.max(...goals.map((g) => g.targetMinutes), 1);

  return (
    <ul className="flex flex-col gap-3">
      {goals.map((g) => {
        const targetW = Math.max(4, (g.targetMinutes / maxTarget) * 100);
        const actualW =
          g.targetMinutes > 0
            ? Math.min(100, (g.actualMinutes / g.targetMinutes) * targetW)
            : g.actualMinutes > 0
              ? 8
              : 0;
        return (
          <li key={g.categoryId}>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span style={{ color: g.color }}>{g.categoryName}</span>
              <span className="mono shrink-0 text-tk-ink-2">
                {fmtMins(g.actualMinutes)}
                {g.targetMinutes > 0 ? (
                  <>
                    {" "}
                    / {fmtMins(g.targetMinutes)} · {g.hitPercent}%
                  </>
                ) : null}
              </span>
            </div>
            {g.targetMinutes > 0 ? (
              <div
                className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-tk-surface-2"
                role="presentation"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-25"
                  style={{
                    width: `${targetW}%`,
                    backgroundColor: g.color,
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${actualW}%`,
                    backgroundColor: g.color,
                    opacity: 0.9,
                  }}
                />
              </div>
            ) : (
              <div
                className="mt-1.5 h-1 rounded-full"
                style={{
                  width: `${Math.max(4, (g.actualMinutes / maxTarget) * 100)}%`,
                  backgroundColor: g.color,
                  opacity: 0.85,
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

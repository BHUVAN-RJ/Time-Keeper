"use client";

import type { EstimateWeekPoint } from "@/lib/estimate-weekly-trend";

export function EstimateAccuracyTrend({
  weeks,
}: {
  weeks: EstimateWeekPoint[];
}) {
  const withRatio = weeks.filter((w) => w.ratio != null);
  if (withRatio.length === 0) {
    return (
      <p className="text-[12px] text-tk-ink-3">
        Complete a few tasks with estimates to see your accuracy trend.
      </p>
    );
  }

  const max = Math.max(...withRatio.map((w) => w.ratio!), 1.5);
  const min = Math.min(...withRatio.map((w) => w.ratio!), 0.5);
  const span = Math.max(max - min, 0.2);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2" style={{ height: 88 }}>
        {weeks.map((w) => {
          const h =
            w.ratio != null
              ? Math.max(12, Math.round(((w.ratio - min) / span) * 100))
              : 8;
          return (
            <div
              key={w.weekStarting}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={
                w.ratio != null
                  ? `${w.label}: ${w.ratio.toFixed(2)}× (${w.completedCount} tasks)`
                  : `${w.label}: no data`
              }
            >
              <span className="mono text-[9px] text-tk-ink-4">
                {w.ratio != null ? w.ratio.toFixed(2) : "—"}
              </span>
              <div
                className={`w-full max-w-[36px] rounded-t-md ${
                  w.ratio != null ? "bg-tk-honey/75" : "bg-tk-surface-2"
                }`}
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] text-tk-ink-4">{w.label}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-tk-ink-3">
        Actual ÷ estimate per week. Target ≈ 1.0.
      </p>
    </div>
  );
}

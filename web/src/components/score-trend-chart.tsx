"use client";

type Point = { date: string; score: number };

function fmtDayLabel(date: string) {
  return String(parseInt(date.slice(8, 10), 10));
}

export function ScoreTrendChart({
  trend,
  rollingAvg,
}: {
  trend: Point[];
  rollingAvg: number | null;
}) {
  if (trend.length === 0) {
    return (
      <p className="text-[13px] text-tk-ink-3">
        No scored days in the last 14 days yet.
      </p>
    );
  }

  const max = Math.max(...trend.map((p) => p.score), 100);
  const min = Math.min(...trend.map((p) => p.score), 0);
  const span = Math.max(max - min, 1);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-end justify-between gap-1"
        style={{ height: 120 }}
      >
        {trend.map((p) => {
          const h = Math.max(8, Math.round(((p.score - min) / span) * 100));
          return (
            <div
              key={p.date}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${p.date}: ${p.score}`}
            >
              <span className="mono text-[9px] text-tk-ink-4">{p.score}</span>
              <div
                className="w-full max-w-[28px] rounded-t-md bg-tk-honey/80"
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] text-tk-ink-4">
                {fmtDayLabel(p.date)}
              </span>
            </div>
          );
        })}
      </div>
      {rollingAvg != null ? (
        <p className="text-center text-[11px] text-tk-ink-3">
          7-day avg today:{" "}
          <span className="mono font-medium text-tk-honey">{rollingAvg}</span>
        </p>
      ) : null}
    </div>
  );
}

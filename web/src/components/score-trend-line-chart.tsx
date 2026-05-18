"use client";

type Point = { date: string; score: number };

function fmtDay(date: string) {
  return String(parseInt(date.slice(8, 10), 10));
}

export function ScoreTrendLineChart({
  points,
  height = 140,
}: {
  points: Point[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <p className="text-[13px] text-tk-ink-3">No scored days in this period yet.</p>
    );
  }

  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const w = 320;
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...points.map((p) => p.score), 100);
  const min = Math.min(...points.map((p) => p.score), 0);
  const span = Math.max(max - min, 1);

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? pad.l + innerW / 2
        : pad.l + (i / (points.length - 1)) * innerW;
    const y = pad.t + innerH - ((p.score - min) / span) * innerH;
    return { ...p, x, y };
  });

  const lineD = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const labelStep = points.length > 14 ? Math.ceil(points.length / 7) : 1;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="mx-auto block w-full max-w-md"
        role="img"
        aria-label="Productivity score trend"
      >
        <path
          d={lineD}
          fill="none"
          stroke="var(--tk-honey)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={c.date}>
            <circle
              cx={c.x}
              cy={c.y}
              r={3}
              fill="var(--tk-honey)"
              className="opacity-90"
            >
              <title>{`${c.date}: ${c.score}`}</title>
            </circle>
            {i % labelStep === 0 || i === coords.length - 1 ? (
              <text
                x={c.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-tk-ink-4 text-[9px]"
              >
                {fmtDay(c.date)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

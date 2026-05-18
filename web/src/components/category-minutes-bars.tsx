"use client";

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function CategoryMinutesBars({
  rows,
  emptyMessage = "No tracked time yet.",
}: {
  rows: { name: string; color: string; mins: number }[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-tk-ink-3">{emptyMessage}</p>;
  }

  const maxBar = Math.max(...rows.map((r) => r.mins), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((c) => (
        <li key={c.name}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span style={{ color: c.color }}>{c.name}</span>
            <span className="mono shrink-0 text-tk-ink-2">
              {fmtDuration(c.mins)}
            </span>
          </div>
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-tk-surface-2"
            role="presentation"
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.max(4, (c.mins / maxBar) * 100)}%`,
                backgroundColor: c.color,
                opacity: 0.85,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

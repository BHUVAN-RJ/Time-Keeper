"use client";

import type { getMonthPageData } from "@/actions/month";
import { ScoreTrendLineChart } from "@/components/score-trend-line-chart";
import {
  scoreHoneyOpacity,
  WEEKDAY_HEADERS,
  type MonthDayCell,
} from "@/lib/month-recap";

export type MonthRecapData = Awaited<ReturnType<typeof getMonthPageData>>;

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtBestDay(date: string) {
  const d = parseInt(date.slice(8, 10), 10);
  const mon = date.slice(5, 7);
  return `${mon}/${d}`;
}

function DayCell({ cell }: { cell: MonthDayCell }) {
  const title =
    cell.score != null
      ? `${cell.date}: ${cell.score}`
      : cell.state === "off"
        ? `${cell.date}: off day`
        : cell.state === "vacation"
          ? `${cell.date}: vacation`
          : cell.date;

  if (cell.state === "future") {
    return (
      <div
        title={title}
        className="relative flex h-10 items-center justify-center rounded-md text-[12px] text-tk-ink-4 opacity-30"
      >
        <span className="mono">{cell.dayNum}</span>
      </div>
    );
  }

  if (cell.state === "untracked" || cell.state === "off") {
    return (
      <div
        title={title}
        className="relative flex h-10 items-center justify-center rounded-md bg-tk-surface-2 text-[12px] text-tk-ink-4"
      >
        <span className="mono">{cell.dayNum}</span>
        {cell.state === "off" ? (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-tk-ink-3"
            aria-label="Off day"
          />
        ) : null}
      </div>
    );
  }

  if (cell.state === "vacation") {
    return (
      <div
        title={title}
        className="relative flex h-10 items-center justify-center overflow-hidden rounded-md text-[12px] text-tk-cream"
        style={{
          background: `repeating-linear-gradient(
            -45deg,
            var(--tk-surface-2),
            var(--tk-surface-2) 3px,
            var(--tk-line) 3px,
            var(--tk-line) 6px
          )`,
        }}
      >
        <span className="mono relative z-[1]">{cell.dayNum}</span>
      </div>
    );
  }

  const isRed = cell.state === "red";
  const honey =
    cell.state === "scored" && cell.score != null
      ? scoreHoneyOpacity(cell.score)
      : null;

  return (
    <div
      title={title}
      className="relative flex h-10 items-center justify-center rounded-md text-[12px] text-tk-cream"
      style={{
        background:
          isRed
            ? "color-mix(in srgb, var(--tk-red) 42%, var(--tk-surface-2))"
            : honey != null
              ? `color-mix(in srgb, var(--tk-honey) ${Math.round(honey * 100)}%, var(--tk-surface-2))`
              : "var(--tk-surface-2)",
      }}
    >
      <span className="mono font-medium">{cell.dayNum}</span>
    </div>
  );
}

export function MonthRecapView({ data }: { data: MonthRecapData }) {
  const maxBar = data.maxCategoryMins || 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="card p-5">
        <h1 className="text-[28px] font-semibold tracking-tight text-tk-ink lowercase">
          {data.headlineMonth}
        </h1>
        <dl className="mt-4 flex flex-col gap-2 text-[14px] text-tk-ink-2">
          <div className="flex flex-wrap gap-x-2">
            <dt>Avg score:</dt>
            <dd>
              <span className="mono text-[21px] font-semibold text-tk-honey">
                {data.avgScore ?? "—"}
              </span>
              {data.lastMonthAvgScore != null ? (
                <span className="text-tk-ink-3">
                  {" "}
                  (last month:{" "}
                  <span className="mono text-[16px] text-tk-ink-2">
                    {data.lastMonthAvgScore}
                  </span>
                  )
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>Days tracked:</dt>
            <dd>
              <span className="mono text-[21px] font-semibold text-tk-cream">
                {data.daysTracked}
              </span>
              <span className="mono text-tk-ink-3">
                {" "}
                / {data.totalDaysInMonth}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>Red days:</dt>
            <dd className="mono text-[21px] font-semibold text-tk-ink-2">
              {data.redDays}
            </dd>
          </div>
          {data.bestDay ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>Best day:</dt>
              <dd>
                <span className="mono text-[16px] text-tk-cream">
                  {fmtBestDay(data.bestDay.date)}
                </span>
                <span className="mono text-[21px] font-semibold text-tk-honey">
                  {" "}
                  ({data.bestDay.score})
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      <section className="card p-4">
        <p className="eyebrow">Calendar</p>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="flex h-7 items-center justify-center text-[10px] font-medium text-tk-ink-4"
            >
              {label}
            </div>
          ))}
          {data.calendarCells.map((cell, i) =>
            cell ? (
              <DayCell key={cell.date} cell={cell} />
            ) : (
              <div key={`pad-${i}`} className="h-10" aria-hidden />
            ),
          )}
        </div>
      </section>

      <section className="card p-4">
        <p className="eyebrow">Score trend</p>
        <div className="mt-3">
          <ScoreTrendLineChart points={data.scoreTrend} />
        </div>
      </section>

      <section className="card p-4">
        <p className="eyebrow">Time by category</p>
        {data.categoryMinutes.length === 0 ? (
          <p className="mt-3 text-[13px] text-tk-ink-3">
            No tracked time this month yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {data.categoryMinutes.map((c) => (
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
        )}
      </section>

      {data.tagsEnabled ? (
      <section className="card p-4">
        <p className="eyebrow">Time by tag</p>
        {data.tagBreakdown.length === 0 ? (
          <p className="mt-3 text-[13px] text-tk-ink-3">
            No tagged blocks this month yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.tagBreakdown.map((t) => (
              <li
                key={t.name}
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="rounded-md bg-tk-surface-2 px-2 py-0.5 text-tk-ink-2">
                  {t.name}
                </span>
                <span className="mono text-tk-ink-3">
                  {fmtDuration(t.mins)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}

      <section className="card p-4">
        <p className="eyebrow">Time by quality</p>
        {data.qualityBreakdown.length === 0 ? (
          <p className="mt-3 text-[13px] text-tk-ink-3">
            No quality-rated blocks this month yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {data.qualityBreakdown.map((q) => (
              <li key={q.quality}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-tk-ink-2">{q.label}</span>
                  <span className="mono shrink-0 text-tk-ink-3">
                    {fmtDuration(q.mins)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-tk-surface-2"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-tk-honey/70"
                    style={{
                      width: `${Math.max(4, (q.mins / data.maxQualityMins) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import type {
  CompletedTaskHistoryRow,
  DayNoteHistoryRow,
  DroppedTaskHistoryRow,
  getStatsPageData,
  TimeBlockHistoryRow,
} from "@/actions/stats";
import { formatCredits } from "@/lib/credits";
import { qualityLabel } from "@/lib/quality";

type StatsData = Awaited<ReturnType<typeof getStatsPageData>>;

function fmtWhen(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fmtDay(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function estimateDelta(estimate: number, actual: number) {
  if (estimate <= 0) return null;
  const pct = Math.round(((actual - estimate) / estimate) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function MoodDots({ mood }: { mood: number | null }) {
  if (mood == null) return null;
  return <span className="text-[11px] text-tk-ink-3">Mood {mood}/5</span>;
}

function HistoryEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-tk-ink-3">{children}</p>;
}

function CompletedTaskItem({
  task,
  timeZone,
}: {
  task: CompletedTaskHistoryRow;
  timeZone: string;
}) {
  const delta = estimateDelta(task.estimateMinutes, task.actualMinutes);
  return (
    <details className="rounded-xl border border-tk-line bg-tk-surface/50">
      <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-tk-ink">{task.title}</div>
            <p className="mt-0.5 text-[11px] text-tk-ink-3">
              {fmtWhen(task.completedAt, timeZone)}
              {task.categoryName ? (
                <>
                  {" "}
                  ·{" "}
                  <span style={{ color: task.categoryColor ?? undefined }}>
                    {task.categoryName}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <span className="shrink-0 text-[11px] text-tk-honey">Done</span>
        </div>
      </summary>
      <div className="border-t border-tk-line px-3 pb-3 pt-2 text-[12px] text-tk-ink-2">
        <p>
          {task.estimateMinutes}m estimated → {task.actualMinutes}m actual
          {delta ? ` (${delta})` : ""}
        </p>
        {task.dueDate ? <p className="mt-1">Due: {task.dueDate}</p> : null}
        {task.scheduledDate ? (
          <p className="mt-0.5">Scheduled: {task.scheduledDate}</p>
        ) : null}
        {task.description ? (
          <p className="mt-2 whitespace-pre-wrap text-tk-ink">{task.description}</p>
        ) : null}
      </div>
    </details>
  );
}

function DroppedTaskItem({
  task,
  timeZone,
}: {
  task: DroppedTaskHistoryRow;
  timeZone: string;
}) {
  return (
    <details className="rounded-xl border border-tk-line bg-tk-surface/50">
      <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-tk-ink">{task.title}</div>
            <p className="mt-0.5 text-[11px] text-tk-ink-3">
              {fmtWhen(task.droppedAt, timeZone)}
              {task.rescheduleCount >= 3 ? (
                <span className="text-tk-warn"> · ↻ {task.rescheduleCount}</span>
              ) : null}
            </p>
          </div>
          <span className="shrink-0 text-[11px] text-tk-warn">Dropped</span>
        </div>
      </summary>
      <div className="border-t border-tk-line px-3 pb-3 pt-2 text-[12px] text-tk-ink-2">
        <p className="font-medium text-tk-ink">Reason</p>
        <p className="mt-1 whitespace-pre-wrap">{task.dropReason}</p>
        <p className="mt-2">{task.estimateMinutes}m estimated</p>
        {task.description ? (
          <p className="mt-2 whitespace-pre-wrap text-tk-ink">{task.description}</p>
        ) : null}
      </div>
    </details>
  );
}

function DayNoteItem({
  row,
  timeZone,
}: {
  row: DayNoteHistoryRow;
  timeZone: string;
}) {
  return (
    <details className="rounded-xl border border-tk-line bg-tk-surface/50">
      <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-tk-ink">{fmtDay(row.date, timeZone)}</div>
            <p className="mt-0.5 text-[11px] text-tk-ink-3">{row.date}</p>
          </div>
          <MoodDots mood={row.mood} />
        </div>
      </summary>
      <div className="border-t border-tk-line px-3 pb-3 pt-2 text-[12px] text-tk-ink-2">
        {row.closedAt ? (
          <p className="text-[11px] text-tk-ink-3">
            End Day: {fmtWhen(row.closedAt, timeZone)}
          </p>
        ) : null}
        {row.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-tk-ink">{row.notes}</p>
        ) : (
          <p className="mt-2 text-tk-ink-3">No notes for this day.</p>
        )}
        {row.tomorrowsTop3.length > 0 ? (
          <div className="mt-3">
            <p className="text-[11px] font-medium text-tk-ink-3">
              Next day top 3
            </p>
            <ol className="mt-1 list-decimal pl-4 text-tk-ink">
              {row.tomorrowsTop3.map((t, i) => (
                <li key={`${row.date}-${i}`}>{t}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function TimeBlockItem({
  block,
  timeZone,
}: {
  block: TimeBlockHistoryRow;
  timeZone: string;
}) {
  return (
    <details className="rounded-xl border border-tk-line bg-tk-surface/50">
      <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-2">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: block.categoryColor }}
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-tk-ink">
              {block.label || "(no label)"}
            </div>
            <p className="mt-0.5 text-[11px] text-tk-ink-3">
              {block.categoryName} · {fmtWhen(block.endAt, timeZone)}
              {block.quality ? ` · ${qualityLabel(block.quality)}` : ""}
            </p>
          </div>
          {block.manualEntry ? (
            <span className="chip-line shrink-0 text-[10px]">Manual</span>
          ) : null}
        </div>
      </summary>
      <div className="border-t border-tk-line px-3 pb-3 pt-2 text-[12px] text-tk-ink-2">
        <p>
          {fmtWhen(block.startAt, timeZone)} → {fmtWhen(block.endAt, timeZone)}
        </p>
        {block.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-tk-ink">{block.notes}</p>
        ) : (
          <p className="mt-2 text-tk-ink-3">No block notes.</p>
        )}
      </div>
    </details>
  );
}

function HistorySection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card overflow-hidden" open={defaultOpen}>
      <summary className="eyebrow cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-[11px] font-normal text-tk-ink-3">{count}</span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-tk-line px-4 pb-4 pt-1">
        {children}
      </div>
    </details>
  );
}

export function StatsClient({ data }: { data: StatsData }) {
  const max = Math.max(100, ...data.trend.map((t) => t.score), 1);
  const tz = data.timezone;

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Stats</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          Scores, trends, and your last {data.historyDays} days of history.
        </p>
      </div>

      <div className="card p-4">
        <div className="eyebrow">Credits (all time)</div>
        <div className="mono mt-1 text-[24px] font-semibold text-tk-honey">
          {formatCredits(data.creditBalance)}
        </div>
      </div>

      <div className="card p-4">
        <div className="eyebrow">Today</div>
        <div className="mono mt-1 text-[32px] font-semibold text-tk-honey">
          {data.todayScore}
        </div>
        {data.rollingAvg != null ? (
          <p className="mt-1 text-[12px] text-tk-ink-3">
            7-day avg: {data.rollingAvg}
            {data.scoreVsAvg != null
              ? ` (${data.scoreVsAvg >= 0 ? "+" : ""}${data.scoreVsAvg})`
              : ""}
          </p>
        ) : null}
      </div>

      {data.trend.length > 0 ? (
        <div className="card p-4">
          <div className="eyebrow">Recent days</div>
          <ul className="mt-3 flex flex-col gap-2">
            {data.trend.map((t) => (
              <li key={t.date} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[11px] text-tk-ink-4">
                  {t.date.slice(5)}
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-tk-surface-2"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-tk-honey"
                    style={{ width: `${(t.score / max) * 100}%` }}
                  />
                </div>
                <span className="mono w-8 text-right text-[12px] text-tk-ink">
                  {t.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="eyebrow px-1">History</h2>

        <HistorySection
          title="Completed tasks"
          count={data.completed.length}
          defaultOpen
        >
          {data.completed.length === 0 ? (
            <HistoryEmpty>No completed tasks in this window.</HistoryEmpty>
          ) : (
            data.completed.map((t) => (
              <CompletedTaskItem key={t.id} task={t} timeZone={tz} />
            ))
          )}
        </HistorySection>

        <HistorySection title="Dropped tasks" count={data.dropped.length}>
          {data.dropped.length === 0 ? (
            <HistoryEmpty>No dropped tasks in this window.</HistoryEmpty>
          ) : (
            data.dropped.map((t) => (
              <DroppedTaskItem key={t.id} task={t} timeZone={tz} />
            ))
          )}
        </HistorySection>

        <HistorySection title="End day notes" count={data.dayNotes.length}>
          {data.dayNotes.length === 0 ? (
            <HistoryEmpty>
              No closed days with notes or mood in this window.
            </HistoryEmpty>
          ) : (
            data.dayNotes.map((r) => (
              <DayNoteItem key={r.date} row={r} timeZone={tz} />
            ))
          )}
        </HistorySection>

        <HistorySection
          title="Time blocks"
          count={data.timeBlocksHistory.length}
        >
          {data.timeBlocksHistory.length === 0 ? (
            <HistoryEmpty>No stopped blocks in this window.</HistoryEmpty>
          ) : (
            <>
              {data.timeBlocksHistory.length >= 50 ? (
                <p className="text-[11px] text-tk-ink-4">
                  Showing latest 50 blocks.
                </p>
              ) : null}
              {data.timeBlocksHistory.map((b) => (
                <TimeBlockItem key={b.id} block={b} timeZone={tz} />
              ))}
            </>
          )}
        </HistorySection>
      </div>

      {data.slumpModeStub ? (
        <p className="text-[11px] text-tk-ink-4">
          Slump mode stub active (v0.4 will gate PM review). Δ{" "}
          {data.slumpDeltaStub ?? "—"}
        </p>
      ) : null}

      <Link href="/today" className="btn-ghost text-center text-[13px]">
        Back to Today
      </Link>
    </div>
  );
}

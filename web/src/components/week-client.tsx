"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWeekData, type NextWeekTaskRow } from "@/actions/week";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { RevertOffDayButton } from "@/components/revert-off-day-button";
import {
  CalendarEventsList,
  CalendarStaleBanner,
} from "@/components/calendar-events-list";
import { groupEventsByDate, formatEventWhen } from "@/lib/google-calendar/format";
import { WeeklyReviewPanel } from "@/components/weekly-review-panel";
import { CategoryGoalsChart } from "@/components/category-goals-chart";
import {
  eisenhowerQuadrant,
  QUADRANT_META,
} from "@/lib/eisenhower";
import {
  dayLabelInWeek,
  dateInWeek,
  weekDateRange,
  WEEK_DAY_LABELS,
} from "@/lib/week-day-label";
import type { CalendarEventView } from "@/lib/google-calendar/types";

function WeekCollapsible({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="eyebrow">{title}</span>
        {hint ? (
          <span className="text-[10px] font-normal normal-case text-tk-ink-4">
            {hint}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-tk-line">{children}</div>
    </details>
  );
}

function DayBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-tk-honey">
      {label}
    </span>
  );
}

function WeekEventRow({
  ev,
  dayLabel,
  timeZone,
}: {
  ev: CalendarEventView;
  dayLabel: string;
  timeZone: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-tk-line px-3 py-2 text-[12px]">
      <div className="min-w-0">
        <div className="font-medium text-tk-ink">{ev.title}</div>
        <p className="mt-0.5 text-tk-ink-3">
          {formatEventWhen(ev, timeZone)}
          {ev.allDay ? " · all day" : ""}
        </p>
        <p className="mt-0.5 text-[10px] text-tk-ink-4">{ev.calendarName}</p>
      </div>
      <DayBadge label={dayLabel} />
    </li>
  );
}

function taskPrimaryDate(t: NextWeekTaskRow, weekMonday: string): string | null {
  if (t.scheduledDate && dateInWeek(t.scheduledDate, weekMonday)) {
    return t.scheduledDate;
  }
  if (t.dueDate && dateInWeek(t.dueDate, weekMonday)) {
    return t.dueDate;
  }
  return null;
}

function sortPrepTasks(
  tasks: NextWeekTaskRow[],
  weekMonday: string,
): NextWeekTaskRow[] {
  return [...tasks].sort((a, b) => {
    const qa = eisenhowerQuadrant(a.urgency, a.importance);
    const qb = eisenhowerQuadrant(b.urgency, b.importance);
    if (qa !== qb) return qa - qb;
    const da = taskPrimaryDate(a, weekMonday);
    const db = taskPrimaryDate(b, weekMonday);
    if (da && db && da !== db) return da.localeCompare(db);
    if (da && !db) return -1;
    if (!da && db) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

function WeekTaskRow({
  t,
  weekMonday,
}: {
  t: NextWeekTaskRow;
  weekMonday: string;
}) {
  const primary = taskPrimaryDate(t, weekMonday);
  const day = primary != null ? dayLabelInWeek(primary, weekMonday) : null;
  const quadrant = eisenhowerQuadrant(t.urgency, t.importance);
  const code = QUADRANT_META[quadrant].code;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-tk-line px-3 py-2 text-[12px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-tk-ink">{t.title}</span>
          <span className="rounded-md bg-tk-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-tk-ink-3">
            {code}
          </span>
        </div>
        <div className="text-tk-ink-3">{t.estimateMinutes}m</div>
      </div>
      {day ? <DayBadge label={day} /> : null}
    </li>
  );
}

export function WeekClient({
  retrospectiveWeekStarting,
  retrospectivePending,
}: {
  retrospectiveWeekStarting: string;
  retrospectivePending: boolean;
}) {
  const [retroCompletedLocally, setRetroCompletedLocally] = useState(false);

  const [prevRetroWeek, setPrevRetroWeek] = useState(retrospectiveWeekStarting);
  if (retrospectiveWeekStarting !== prevRetroWeek) {
    setPrevRetroWeek(retrospectiveWeekStarting);
    setRetroCompletedLocally(false);
  }

  const retroPending = retrospectivePending && !retroCompletedLocally;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["week"],
    queryFn: () => getWeekData(),
  });

  const thisWeekCalendarRows = useMemo(() => {
    if (!data) return [];
    const dates = data.days.map((d) => d.date);
    const byDay = groupEventsByDate(
      data.calendarThisWeek.events,
      dates,
      data.timezone,
    );
    const rows: { ev: CalendarEventView; dayLabel: string; sortKey: string }[] =
      [];
    for (const { date, events } of byDay) {
      const label = dayLabelInWeek(date, data.weekStart);
      if (!label) continue;
      for (const ev of events) {
        rows.push({ ev, dayLabel: label, sortKey: date });
      }
    }
    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return rows;
  }, [data]);

  const nextWeekCalendarRows = useMemo(() => {
    if (!data) return [];
    const dates = weekDateRange(data.nextWeekStart);
    const byDay = groupEventsByDate(
      data.calendarNextWeek.events,
      dates,
      data.timezone,
    );
    const rows: { ev: CalendarEventView; dayLabel: string; sortKey: string }[] =
      [];
    for (const { date, events } of byDay) {
      const label = dayLabelInWeek(date, data.nextWeekStart);
      if (!label) continue;
      for (const ev of events) {
        rows.push({ ev, dayLabel: label, sortKey: date });
      }
    }
    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return rows;
  }, [data]);

  const sortedNextTasks = useMemo(
    () =>
      data ? sortPrepTasks(data.nextWeekTasks, data.nextWeekStart) : [],
    [data],
  );

  const sortedThisWeekTasks = useMemo(
    () => (data ? sortPrepTasks(data.thisWeekTasks, data.weekStart) : []),
    [data],
  );

  if (isLoading) {
    return <PageLoadingShell title="This week" rows={7} />;
  }

  if (isError || !data) {
    return (
      <div className="py-8 text-center text-[13px] text-tk-ink-3">
        Could not load this week.{" "}
        <button
          type="button"
          className="text-tk-honey underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">This week</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">Week of {data.weekStart}</p>
      </div>

      <WeekCollapsible
        title="Weekly retrospective"
        hint={retroPending ? "Ready for you" : "Completed"}
        defaultOpen={retroPending}
      >
        <WeeklyReviewPanel
          weekStarting={retrospectiveWeekStarting}
          embedded
          onCompleted={() => setRetroCompletedLocally(true)}
        />
      </WeekCollapsible>

      <WeekCollapsible title="This week · time vs goals" defaultOpen>
        <div className="px-4 pb-4 pt-2">
          <CategoryGoalsChart
            goals={data.weekCategoryGoals}
            emptyMessage="Close days this week to see category totals vs goals."
          />
        </div>
      </WeekCollapsible>

      <WeekCollapsible
        title="Open tasks this week"
        hint={`${data.thisWeekTasks.length} active`}
      >
        <div className="px-4 pb-4 pt-2">
          {sortedThisWeekTasks.length === 0 ? (
            <p className="text-[12px] text-tk-ink-3">
              No open tasks scheduled or due this week.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sortedThisWeekTasks.map((t) => (
                <WeekTaskRow key={t.id} t={t} weekMonday={data.weekStart} />
              ))}
            </ul>
          )}
        </div>
      </WeekCollapsible>

      <WeekCollapsible title="Weekly rundown · calendar" defaultOpen>
        <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
          <CalendarStaleBanner meta={data.calendarThisWeek.meta} />
          {!data.calendarThisWeek.meta.connected ? (
            <CalendarEventsList
              events={[]}
              meta={data.calendarThisWeek.meta}
              timeZone={data.timezone}
              compact
            />
          ) : thisWeekCalendarRows.length === 0 ? (
            <p className="text-[12px] text-tk-ink-3">No calendar events this week.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {thisWeekCalendarRows.map(({ ev, dayLabel }) => (
                <WeekEventRow
                  key={`${ev.id}-${dayLabel}`}
                  ev={ev}
                  dayLabel={dayLabel}
                  timeZone={data.timezone}
                />
              ))}
            </ul>
          )}
        </div>
      </WeekCollapsible>

      <WeekCollapsible title="Next week prep" defaultOpen>
        <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
          <div>
            <div className="text-[12px] font-medium text-tk-ink">
              Internal tasks
            </div>
            <p className="mt-0.5 text-[11px] text-tk-ink-3">
              {data.nextWeekTasks.length} tasks · ~{data.plannedMinutes}m planned ·
              Eisenhower order
            </p>
            {sortedNextTasks.length === 0 ? (
              <p className="mt-2 text-[12px] text-tk-ink-3">
                Nothing scheduled or due next week yet.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {sortedNextTasks.map((t) => (
                  <WeekTaskRow
                    key={t.id}
                    t={t}
                    weekMonday={data.nextWeekStart}
                  />
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-[12px] font-medium text-tk-ink">
              Google Calendar
            </div>
            {!data.calendarNextWeek.meta.connected ? (
              <div className="mt-2">
                <CalendarEventsList
                  events={[]}
                  meta={data.calendarNextWeek.meta}
                  timeZone={data.timezone}
                  compact
                  emptyMessage="Connect Google Calendar in Settings."
                />
              </div>
            ) : nextWeekCalendarRows.length === 0 ? (
              <p className="mt-2 text-[12px] text-tk-ink-3">
                No calendar events next week.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {nextWeekCalendarRows.map(({ ev, dayLabel }) => (
                  <WeekEventRow
                    key={`${ev.id}-${dayLabel}`}
                    ev={ev}
                    dayLabel={dayLabel}
                    timeZone={data.timezone}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </WeekCollapsible>

      {data.weekOverworkMinutes > 0 ? (
        <div className="card p-4">
          <p className="eyebrow">Overwork this week</p>
          <p className="mt-1 text-[14px] text-tk-ink-2">
            <span className="mono text-[20px] font-semibold text-tk-amber">
              {Math.floor(data.weekOverworkMinutes / 60)}h{" "}
              {data.weekOverworkMinutes % 60}m
            </span>{" "}
            beyond your work goals (closed days only).
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-[13px] font-medium text-tk-ink">Daily scores</h2>
          {data.avgScore != null ? (
            <span className="text-[11px] text-tk-ink-3">
              Avg <span className="mono text-tk-honey">{data.avgScore}</span>
            </span>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {data.days.map((d, i) => {
            const isFuture = d.date > data.today;
            const showMetrics =
              d.hasActivity && !isFuture && !d.isOffDay && !d.isVacation;
            const dayLabel = WEEK_DAY_LABELS[i];

            return (
              <li
                key={d.date}
                className={`card flex items-center justify-between gap-3 p-3 ${
                  d.date === data.today ? "ring-1 ring-tk-honey/40" : ""
                }`}
              >
                <div>
                  <div className="text-[13px] font-medium text-tk-ink">
                    {dayLabel}{" "}
                    <span className="text-tk-ink-3">{d.date.slice(5)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-tk-ink-3">
                    {d.isVacation ? (
                      <span className="text-tk-ink-2">Vacation</span>
                    ) : d.isOffDay ? (
                      <span className="text-tk-ink-2">
                        {d.date === data.today
                          ? "Today is an off day"
                          : "Off day"}
                      </span>
                    ) : isFuture ? (
                      "Upcoming"
                    ) : showMetrics ? (
                      `Goal ${d.goalHitPercent}%${d.endedAt ? " · closed" : ""}`
                    ) : (
                      "No activity yet"
                    )}
                  </div>
                  {d.isOffDay && !d.isVacation ? (
                    <div className="mt-1">
                      <RevertOffDayButton date={d.date} />
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  {d.isVacation ? (
                    <div className="text-[13px] text-tk-ink-3">Vacation</div>
                  ) : d.isOffDay ? (
                    <div className="text-[13px] text-tk-ink-3">Off</div>
                  ) : showMetrics ? (
                    <>
                      <div
                        className={`mono text-[18px] font-semibold ${
                          d.isRed ? "text-tk-red" : "text-tk-honey"
                        }`}
                      >
                        {d.productivityScore}
                      </div>
                      <div className="text-[10px] text-tk-ink-4">score</div>
                    </>
                  ) : (
                    <div className="text-[13px] text-tk-ink-4">—</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Link href="/today" className="btn-ghost text-center text-[13px]">
        Back to Today
      </Link>
    </div>
  );
}

import Link from "next/link";
import type { getWeekData } from "@/actions/week";
import { RevertOffDayButton } from "@/components/revert-off-day-button";
import {
  CalendarEventsList,
  CalendarStaleBanner,
} from "@/components/calendar-events-list";
import { groupEventsByDate } from "@/lib/google-calendar/format";
type WeekData = Awaited<ReturnType<typeof getWeekData>>;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekClient({ data }: { data: WeekData }) {
  const thisWeekDates = data.days.map((d) => d.date);
  const thisWeekByDay = groupEventsByDate(
    data.calendarThisWeek.events,
    thisWeekDates,
    data.timezone,
  );

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">This week</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          Week of {data.weekStart}
          {data.avgScore != null ? ` · avg score ${data.avgScore}` : ""}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {data.days.map((d, i) => {
          const isFuture = d.date > data.today;
          const showMetrics = d.hasActivity && !isFuture && !d.isOffDay;

          return (
            <li
              key={d.date}
              className={`card flex items-center justify-between gap-3 p-3 ${
                d.date === data.today ? "ring-1 ring-tk-honey/40" : ""
              }`}
            >
              <div>
                <div className="text-[13px] font-medium text-tk-ink">
                  {DAY_LABELS[i]}{" "}
                  <span className="text-tk-ink-3">{d.date.slice(5)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-tk-ink-3">
                  {d.isOffDay ? (
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
                {d.isOffDay ? (
                  <div className="mt-1">
                    <RevertOffDayButton date={d.date} />
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                {d.isOffDay ? (
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

      <details className="card overflow-hidden" open>
        <summary className="eyebrow cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          Weekly rundown · this week (calendar)
        </summary>
        <div className="flex flex-col gap-3 border-t border-tk-line px-4 pb-4 pt-2">
          <CalendarStaleBanner meta={data.calendarThisWeek.meta} />
          {!data.calendarThisWeek.meta.connected ? (
            <CalendarEventsList
              events={[]}
              meta={data.calendarThisWeek.meta}
              timeZone={data.timezone}
              compact
            />
          ) : (
            thisWeekByDay.map(({ date, events }) =>
              events.length > 0 ? (
                <div key={date}>
                  <div className="text-[11px] font-medium text-tk-ink-3">
                    {date}
                  </div>
                  <ul className="mt-1 flex flex-col gap-1">
                    {events.map((ev) => (
                      <li key={ev.id} className="text-[12px] text-tk-ink-2">
                        {ev.title}
                        <span className="text-tk-ink-4">
                          {" "}
                          · {ev.calendarName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )
          )}
        </div>
      </details>

      <details className="card overflow-hidden" open>
        <summary className="eyebrow cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          Next week prep
        </summary>
        <div className="flex flex-col gap-4 border-t border-tk-line px-4 pb-4 pt-2">
          <div>
            <div className="text-[12px] font-medium text-tk-ink">
              Internal tasks
            </div>
            <p className="mt-0.5 text-[11px] text-tk-ink-3">
              {data.nextWeekTasks.length} tasks · ~{data.plannedMinutes}m
              planned
            </p>
            {data.nextWeekTasks.length === 0 ? (
              <p className="mt-2 text-[12px] text-tk-ink-3">
                Nothing scheduled or due next week yet.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.nextWeekTasks.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-tk-line px-3 py-2 text-[12px]"
                  >
                    <div className="font-medium text-tk-ink">{t.title}</div>
                    <div className="text-tk-ink-3">
                      {t.estimateMinutes}m
                      {t.scheduledDate
                        ? ` · sched ${t.scheduledDate.slice(5)}`
                        : ""}
                      {t.dueDate ? ` · due ${t.dueDate.slice(5)}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-[12px] font-medium text-tk-ink">
              Google Calendar
            </div>
            <div className="mt-2">
              <CalendarEventsList
                events={data.calendarNextWeek.events}
                meta={data.calendarNextWeek.meta}
                timeZone={data.timezone}
                emptyMessage="No calendar events next week."
              />
            </div>
          </div>
        </div>
      </details>

      <Link href="/today" className="btn-ghost text-center text-[13px]">
        Back to Today
      </Link>
    </div>
  );
}

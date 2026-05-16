import Link from "next/link";
import type { getWeekData } from "@/actions/week";
import { RevertOffDayButton } from "@/components/revert-off-day-button";

type WeekData = Awaited<ReturnType<typeof getWeekData>>;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekClient({ data }: { data: WeekData }) {
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

      <Link href="/today" className="btn-ghost text-center text-[13px]">
        Back to Today
      </Link>
    </div>
  );
}

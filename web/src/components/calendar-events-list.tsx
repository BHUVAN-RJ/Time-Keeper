import { formatEventWhen } from "@/lib/google-calendar/format";
import type {
  CalendarEventView,
  CalendarFetchMeta,
} from "@/lib/google-calendar/types";

export function CalendarStaleBanner({ meta }: { meta: CalendarFetchMeta }) {
  if (!meta.stale && !meta.error) return null;
  return (
    <p className="rounded-lg border border-tk-warn/30 bg-tk-warn/10 px-3 py-2 text-[11px] text-tk-warn">
      {meta.error
        ? `Showing cached calendar data. ${meta.error}`
        : "Showing cached calendar data."}
      {meta.fetchedAt ? (
        <span className="block text-tk-ink-4">
          Last synced{" "}
          {new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(meta.fetchedAt))}
        </span>
      ) : null}
    </p>
  );
}

export function CalendarEventsList({
  events,
  meta,
  timeZone,
  emptyMessage = "No events in this range.",
  compact = false,
}: {
  events: CalendarEventView[];
  meta: CalendarFetchMeta;
  timeZone: string;
  emptyMessage?: string;
  compact?: boolean;
}) {
  if (!meta.configured) {
    return (
      <p className="text-[12px] text-tk-ink-3">
        Google Calendar is not configured on this server.
      </p>
    );
  }

  if (!meta.connected) {
    return (
      <p className="text-[12px] text-tk-ink-3">
        Connect Google Calendar in Settings to see events here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <CalendarStaleBanner meta={meta} />
      {events.length === 0 ? (
        <p className="text-[12px] text-tk-ink-3">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {events.map((ev) => {
            // "Passed" strikethrough applies only to Google Calendar items
            // (FR-016/FR-017): an event whose end time is in the past. This is
            // a server component rendered once per request, so request-time
            // evaluation is intentional.
            // eslint-disable-next-line react-hooks/purity
            const passed = !ev.allDay && new Date(ev.end).getTime() < Date.now();
            return (
              <li
                key={ev.id}
                className={`rounded-lg border border-tk-line bg-tk-surface/40 px-3 py-2 ${compact ? "text-[11px]" : "text-[12px]"}`}
              >
                <div
                  className={`font-medium ${passed ? "text-tk-ink-3 line-through" : "text-tk-ink"}`}
                >
                  {ev.title}
                </div>
                <p className="mt-0.5 text-tk-ink-3">
                  {formatEventWhen(ev, timeZone)}
                  {ev.allDay ? " · all day" : ""}
                  {passed ? " · passed" : ""}
                </p>
                <p className="mt-0.5 text-[10px] text-tk-ink-4">
                  {ev.calendarName} · {ev.accountEmail}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

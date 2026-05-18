import { cache } from "react";
import { fetchCalendarEventsForRange } from "@/lib/google-calendar/service";
import { multiDayRangeUtc } from "@/lib/google-calendar/ranges";

/** One Google Calendar fetch per request (shared by today extras + AM rundown). */
export const getTodayCalendarEvents = cache(
  async (
    userId: string,
    today: string,
    tomorrow: string,
    timezone: string,
  ) => {
    const range = multiDayRangeUtc(today, tomorrow, timezone);
    return fetchCalendarEventsForRange(
      userId,
      today,
      tomorrow,
      range.timeMin,
      range.timeMax,
    );
  },
);

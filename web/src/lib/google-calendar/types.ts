export type CalendarEventView = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  accountEmail: string;
  calendarId: string;
  calendarName: string;
  htmlLink: string | null;
};

export type CalendarFetchMeta = {
  connected: boolean;
  configured: boolean;
  stale: boolean;
  error: string | null;
  fetchedAt: string | null;
  accountCount: number;
};

export type CalendarEventsResult = {
  events: CalendarEventView[];
  meta: CalendarFetchMeta;
};

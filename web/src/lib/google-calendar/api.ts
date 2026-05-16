import { googleRedirectUri } from "@/lib/google-calendar/config";
import type { CalendarEventView } from "@/lib/google-calendar/types";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type CalendarListEntry = {
  id: string;
  summary?: string;
  backgroundColor?: string;
};

export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error("Failed to load Google profile");
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Google account has no email");
  return data.email;
}

async function listCalendars(accessToken: string): Promise<CalendarListEntry[]> {
  const items: CalendarListEntry[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Calendar list failed: ${text}`);
    }
    const data = (await res.json()) as {
      items?: CalendarListEntry[];
      nextPageToken?: string;
    };
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

function parseGoogleEvent(
  ev: GoogleEvent,
  accountEmail: string,
  calendar: CalendarListEntry,
): CalendarEventView | null {
  const startRaw = ev.start?.dateTime ?? ev.start?.date;
  const endRaw = ev.end?.dateTime ?? ev.end?.date;
  if (!startRaw || !endRaw || !ev.id) return null;

  const allDay = !ev.start?.dateTime;
  return {
    id: `${accountEmail}:${calendar.id}:${ev.id}`,
    title: ev.summary?.trim() || "(No title)",
    start: allDay ? `${ev.start!.date!}T00:00:00.000Z` : startRaw,
    end: allDay ? `${ev.end!.date!}T00:00:00.000Z` : endRaw,
    allDay,
    accountEmail,
    calendarId: calendar.id,
    calendarName: calendar.summary ?? calendar.id,
    htmlLink: ev.htmlLink ?? null,
  };
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Events fetch failed: ${text}`);
    }
    const data = (await res.json()) as {
      items?: GoogleEvent[];
      nextPageToken?: string;
    };
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export async function fetchAllEventsForAccount(
  refreshToken: string,
  accountEmail: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEventView[]> {
  const { access_token } = await refreshAccessToken(refreshToken);
  const calendars = await listCalendars(access_token);
  const events: CalendarEventView[] = [];

  for (const cal of calendars) {
    const raw = await fetchCalendarEvents(
      access_token,
      cal.id,
      timeMin,
      timeMax,
    );
    for (const ev of raw) {
      const parsed = parseGoogleEvent(ev, accountEmail, cal);
      if (parsed) events.push(parsed);
    }
  }

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  return events;
}

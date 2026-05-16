import { db } from "@/db";
import {
  googleCalendarAccounts,
  googleCalendarEventCache,
} from "@/db/schema";
import { fetchAllEventsForAccount } from "@/lib/google-calendar/api";
import {
  CALENDAR_CACHE_TTL_MS,
  googleCalendarConfigured,
} from "@/lib/google-calendar/config";
import type {
  CalendarEventView,
  CalendarEventsResult,
  CalendarFetchMeta,
} from "@/lib/google-calendar/types";
import { filterCalendarEvents } from "@/lib/google-calendar/filters";
import { getCalendarExcludeCustomLines } from "@/lib/google-calendar/preferences";
import { decryptSecret } from "@/lib/token-crypto";
import { and, eq } from "drizzle-orm";

function baseMeta(
  connected: boolean,
  accountCount: number,
  overrides: Partial<CalendarFetchMeta> = {},
): CalendarFetchMeta {
  return {
    configured: googleCalendarConfigured(),
    connected,
    stale: false,
    error: null,
    fetchedAt: null,
    accountCount,
    ...overrides,
  };
}

async function readCache(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<{ events: CalendarEventView[]; fetchedAt: Date } | null> {
  const [row] = await db
    .select()
    .from(googleCalendarEventCache)
    .where(
      and(
        eq(googleCalendarEventCache.userId, userId),
        eq(googleCalendarEventCache.rangeStart, rangeStart),
        eq(googleCalendarEventCache.rangeEnd, rangeEnd),
      ),
    )
    .limit(1);

  if (!row) return null;
  try {
    const events = JSON.parse(row.eventsJson) as CalendarEventView[];
    return { events, fetchedAt: new Date(row.fetchedAt) };
  } catch {
    return null;
  }
}

async function writeCache(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  events: CalendarEventView[],
) {
  const now = new Date();
  await db
    .insert(googleCalendarEventCache)
    .values({
      userId,
      rangeStart,
      rangeEnd,
      eventsJson: JSON.stringify(events),
      fetchedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        googleCalendarEventCache.userId,
        googleCalendarEventCache.rangeStart,
        googleCalendarEventCache.rangeEnd,
      ],
      set: {
        eventsJson: JSON.stringify(events),
        fetchedAt: now,
        updatedAt: now,
      },
    });
}

export async function listGoogleCalendarAccounts(userId: string) {
  return db
    .select({
      id: googleCalendarAccounts.id,
      googleEmail: googleCalendarAccounts.googleEmail,
      createdAt: googleCalendarAccounts.createdAt,
    })
    .from(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.userId, userId))
    .orderBy(googleCalendarAccounts.createdAt);
}

export async function fetchCalendarEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  timeMin: string,
  timeMax: string,
  options?: { forceRefresh?: boolean },
): Promise<CalendarEventsResult> {
  if (!googleCalendarConfigured()) {
    return { events: [], meta: baseMeta(false, 0) };
  }

  const accounts = await db
    .select()
    .from(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.userId, userId));

  if (accounts.length === 0) {
    return { events: [], meta: baseMeta(false, 0) };
  }

  const excludeCustom = await getCalendarExcludeCustomLines(userId);

  const cached = await readCache(userId, rangeStart, rangeEnd);
  const cacheFresh =
    cached &&
    Date.now() - cached.fetchedAt.getTime() < CALENDAR_CACHE_TTL_MS;

  if (!options?.forceRefresh && cacheFresh && cached) {
    return {
      events: filterCalendarEvents(cached.events, excludeCustom),
      meta: baseMeta(true, accounts.length, {
        fetchedAt: cached.fetchedAt.toISOString(),
      }),
    };
  }

  try {
    const merged: CalendarEventView[] = [];
    for (const account of accounts) {
      const refreshToken = decryptSecret(account.refreshTokenEnc);
      const events = await fetchAllEventsForAccount(
        refreshToken,
        account.googleEmail,
        timeMin,
        timeMax,
      );
      merged.push(...events);
    }
    merged.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    const filtered = filterCalendarEvents(merged, excludeCustom);
    await writeCache(userId, rangeStart, rangeEnd, filtered);
    return {
      events: filtered,
      meta: baseMeta(true, accounts.length, {
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar sync failed";
    if (cached) {
      return {
        events: filterCalendarEvents(cached.events, excludeCustom),
        meta: baseMeta(true, accounts.length, {
          stale: true,
          error: message,
          fetchedAt: cached.fetchedAt.toISOString(),
        }),
      };
    }
    return {
      events: [],
      meta: baseMeta(true, accounts.length, {
        stale: true,
        error: message,
      }),
    };
  }
}

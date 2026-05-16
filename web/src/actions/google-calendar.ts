"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  googleCalendarAccounts,
  googleCalendarEventCache,
} from "@/db/schema";
import {
  googleCalendarConfigured,
  googleRedirectUri,
} from "@/lib/google-calendar/config";
import {
  getCalendarExcludeCustomLines,
  saveCalendarExcludeCustomLines,
} from "@/lib/google-calendar/preferences";
import { listGoogleCalendarAccounts } from "@/lib/google-calendar/service";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

export async function getGoogleCalendarSettings() {
  const userId = await requireUserId();
  const configured = googleCalendarConfigured();
  const accounts = configured
    ? await listGoogleCalendarAccounts(userId)
    : [];
  const excludeCustomLines = configured
    ? await getCalendarExcludeCustomLines(userId)
    : [];

  return {
    configured,
    redirectUri: configured ? googleRedirectUri() : null,
    builtinExcludeSummary:
      "office hours, OH, drop-in, TA office (title match, case-insensitive)",
    excludeCustomLines,
    accounts: accounts.map((a) => ({
      id: a.id,
      googleEmail: a.googleEmail,
      connectedAt: a.createdAt.toISOString(),
    })),
  };
}

export async function saveCalendarExcludePatternsAction(raw: string) {
  const userId = await requireUserId();
  const lines = await saveCalendarExcludeCustomLines(userId, raw);

  await db
    .delete(googleCalendarEventCache)
    .where(eq(googleCalendarEventCache.userId, userId));

  revalidatePath("/settings");
  revalidatePath("/week");
  revalidatePath("/today");
  return { ok: true as const, lines };
}

export async function disconnectGoogleCalendarAccount(accountId: string) {
  const userId = await requireUserId();

  await db
    .delete(googleCalendarAccounts)
    .where(
      and(
        eq(googleCalendarAccounts.id, accountId),
        eq(googleCalendarAccounts.userId, userId),
      ),
    );

  await db
    .delete(googleCalendarEventCache)
    .where(eq(googleCalendarEventCache.userId, userId));

  revalidatePath("/settings");
  revalidatePath("/week");
  revalidatePath("/today");
  return { ok: true as const };
}

export async function refreshGoogleCalendarCacheAction() {
  const userId = await requireUserId();
  const { fetchCalendarEventsForRange } = await import(
    "@/lib/google-calendar/service"
  );
  const { calendarDayInTz } = await import("@/lib/calendar-day");
  const { format, addDays, parseISO, startOfWeek } = await import("date-fns");
  const { weekRangeUtc, multiDayRangeUtc } = await import(
    "@/lib/google-calendar/ranges"
  );

  const session = await auth();
  const timezone = session?.user?.timezone ?? "America/Los_Angeles";
  const today = calendarDayInTz(new Date(), timezone);
  const thisMonday = format(
    startOfWeek(parseISO(today), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const nextMonday = format(addDays(parseISO(thisMonday), 7), "yyyy-MM-dd");
  const nextSunday = format(addDays(parseISO(nextMonday), 6), "yyyy-MM-dd");

  const thisRange = weekRangeUtc(thisMonday, timezone);
  await fetchCalendarEventsForRange(
    userId,
    thisMonday,
    format(addDays(parseISO(thisMonday), 6), "yyyy-MM-dd"),
    thisRange.timeMin,
    thisRange.timeMax,
    { forceRefresh: true },
  );

  const nextRange = weekRangeUtc(nextMonday, timezone);
  await fetchCalendarEventsForRange(
    userId,
    nextMonday,
    nextSunday,
    nextRange.timeMin,
    nextRange.timeMax,
    { forceRefresh: true },
  );

  const todayRange = multiDayRangeUtc(today, today, timezone);
  await fetchCalendarEventsForRange(
    userId,
    today,
    today,
    todayRange.timeMin,
    todayRange.timeMax,
    { forceRefresh: true },
  );

  revalidatePath("/week");
  revalidatePath("/today");
  return { ok: true as const };
}

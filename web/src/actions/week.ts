"use server";

import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { computeWeekSnapshots } from "@/lib/day-compute";
import { calendarDayInTz } from "@/lib/calendar-day";
import { ensureDefaultCategories } from "@/lib/ensure-categories";
import { format, parseISO, startOfWeek } from "date-fns";

async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  const timezone = session.user.timezone ?? "America/Los_Angeles";
  await ensureDefaultCategories(id, timezone);
  return { userId: id, timezone };
}

export async function getWeekData(weekStart?: string) {
  const { userId, timezone } = await requireUser();
  const today = calendarDayInTz(new Date(), timezone);
  const anchor = weekStart ?? today;
  const monday = format(
    startOfWeek(parseISO(anchor), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );

  const getCachedWeek = unstable_cache(
    async () => computeWeekSnapshots(userId, monday, timezone),
    ["week-snapshots", userId, monday, timezone],
    { revalidate: 86400, tags: [`week-${userId}`] },
  );
  const days = await getCachedWeek();

  const endedDays = days.filter((d) => d.endedAt);
  const avgScore =
    endedDays.length > 0
      ? Math.round(
          endedDays.reduce((s, d) => s + d.productivityScore, 0) /
            endedDays.length,
        )
      : null;

  return { timezone, today, weekStart: monday, days, avgScore };
}

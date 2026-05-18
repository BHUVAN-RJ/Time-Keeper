import { db } from "@/db";
import { dayStatus, tasks, timeBlocks } from "@/db/schema";
import { and, eq, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { overlapMinutes } from "@/lib/block-minutes";
import { getDayRangeUtc } from "@/lib/day-range";
import { addDays, format, parseISO } from "date-fns";

const LOOKBACK_DAYS = 45;
const ACTIVE_TASK = ["backlog", "scheduled", "in_progress"] as const;

function dayHasBlocks(
  blocks: { startAt: Date; endAt: Date | null }[],
  date: string,
  timezone: string,
): boolean {
  const { startUtc, endUtc } = getDayRangeUtc(parseISO(date), timezone);
  for (const b of blocks) {
    const end = b.endAt ?? new Date();
    if (overlapMinutes(new Date(b.startAt), end, startUtc, endUtc) > 0) {
      return true;
    }
  }
  return false;
}

function dayHasTasks(
  rows: {
    scheduledDate: string | null;
    dueDate: string | null;
    status: string;
  }[],
  date: string,
  hasInProgress: boolean,
): boolean {
  if (hasInProgress) return true;
  return rows.some(
    (t) => t.scheduledDate === date || t.dueDate === date,
  );
}

/** Calendar days before `today` with activity but no `ended_at`, oldest first. */
export async function listUnclosedDaysBeforeToday(
  userId: string,
  timezone: string,
  today: string,
): Promise<string[]> {
  const since = format(addDays(parseISO(today), -LOOKBACK_DAYS), "yyyy-MM-dd");
  const { startUtc: sinceStart } = getDayRangeUtc(parseISO(since), timezone);
  const { startUtc: todayStart } = getDayRangeUtc(parseISO(today), timezone);

  const [statusRows, blockRows, taskRows] = await Promise.all([
    db
      .select({ date: dayStatus.date, endedAt: dayStatus.endedAt })
      .from(dayStatus)
      .where(
        and(
          eq(dayStatus.userId, userId),
          gte(dayStatus.date, since),
          lt(dayStatus.date, today),
        ),
      ),
    db
      .select({
        startAt: timeBlocks.startAt,
        endAt: timeBlocks.endAt,
      })
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.userId, userId),
          lte(timeBlocks.startAt, todayStart),
          or(isNull(timeBlocks.endAt), gte(timeBlocks.endAt, sinceStart)),
        ),
      ),
    db
      .select({
        scheduledDate: tasks.scheduledDate,
        dueDate: tasks.dueDate,
        status: tasks.status,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          inArray(tasks.status, [...ACTIVE_TASK]),
          or(
            and(gte(tasks.scheduledDate, since), lt(tasks.scheduledDate, today)),
            and(gte(tasks.dueDate, since), lt(tasks.dueDate, today)),
            eq(tasks.status, "in_progress"),
          ),
        ),
      ),
  ]);

  const statusByDate = new Map(statusRows.map((r) => [r.date, r.endedAt]));
  const blocks = blockRows.map((b) => ({
    startAt: new Date(b.startAt),
    endAt: b.endAt ? new Date(b.endAt) : null,
  }));
  const hasInProgress = taskRows.some((t) => t.status === "in_progress");

  const unclosed: string[] = [];
  for (let i = LOOKBACK_DAYS; i >= 1; i--) {
    const d = format(addDays(parseISO(today), -i), "yyyy-MM-dd");
    if (!statusByDate.has(d)) {
      const active =
        dayHasBlocks(blocks, d, timezone) ||
        dayHasTasks(taskRows, d, hasInProgress);
      if (active) unclosed.push(d);
      continue;
    }
    if (statusByDate.get(d)) continue;
    unclosed.push(d);
  }

  return unclosed;
}

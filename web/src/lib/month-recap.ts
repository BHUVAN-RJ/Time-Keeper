import { addDays, endOfMonth, format, getDay, parseISO, startOfMonth } from "date-fns";

export type MonthDayState =
  | "future"
  | "off"
  | "vacation"
  | "scored"
  | "red"
  | "untracked";

export type MonthDayCell = {
  date: string;
  dayNum: number;
  state: MonthDayState;
  score: number | null;
};

export type MonthStatusRow = {
  date: string;
  endedAt: Date | null;
  isRed: boolean;
  isOffDay: boolean;
  isVacation: boolean;
  productivityScore: number | null;
};

/** Build Sun–Sat grid with leading padding. */
export function buildMonthCalendarCells(
  monthStart: string,
  monthEnd: string,
  today: string,
  statusByDate: Map<string, MonthStatusRow>,
  scoreByDate: Map<string, number>,
): (MonthDayCell | null)[] {
  const start = parseISO(monthStart);
  const end = parseISO(monthEnd);
  const cells: (MonthDayCell | null)[] = [];

  const leading = getDay(start);
  for (let i = 0; i < leading; i++) cells.push(null);

  let d = start;
  while (d <= end) {
    const date = format(d, "yyyy-MM-dd");
    cells.push(classifyMonthDay(date, today, statusByDate.get(date), scoreByDate.get(date)));
    d = addDays(d, 1);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function classifyMonthDay(
  date: string,
  today: string,
  status?: MonthStatusRow,
  persistedScore?: number,
): MonthDayCell {
  const dayNum = parseInt(date.slice(8, 10), 10);

  if (date > today) {
    return { date, dayNum, state: "future", score: null };
  }

  if (status?.isVacation) {
    return { date, dayNum, state: "vacation", score: null };
  }

  if (status?.isOffDay) {
    return { date, dayNum, state: "off", score: persistedScore ?? null };
  }

  const tracked =
    status?.endedAt != null || persistedScore != null;

  if (!tracked) {
    return { date, dayNum, state: "untracked", score: null };
  }

  const score =
    persistedScore ??
    status?.productivityScore ??
    null;

  if (status?.isRed) {
    return { date, dayNum, state: "red", score };
  }

  return { date, dayNum, state: "scored", score };
}

export function monthHeadlineLabel(monthStart: string): string {
  const d = parseISO(monthStart);
  return `${format(d, "MMMM").toLowerCase()} ${format(d, "yyyy")}`;
}

export function daysInMonth(monthStart: string): number {
  const start = parseISO(monthStart);
  const end = endOfMonth(start);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function previousMonthStart(monthStart: string): string {
  const d = parseISO(monthStart);
  return format(startOfMonth(addDays(d, -1)), "yyyy-MM-dd");
}

/** Honey fill opacity for scored days (spec §6). */
export function scoreHoneyOpacity(score: number): number {
  return (score / 100) * 0.6 + 0.2;
}

export const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

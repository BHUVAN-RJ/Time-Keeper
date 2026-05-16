import type { CalendarEventView } from "@/lib/google-calendar/types";

/** Always applied — common academic calendar noise. */
export const BUILTIN_CALENDAR_EXCLUDE: RegExp[] = [
  /\boffice\s*hours?\b/i,
  /\bo\.?\s*h\.?\b/i,
  /\bOH\b/,
  /\bTA\s+office\b/i,
  /\bdrop[- ]?in\b/i,
  /\bholding\s+office\b/i,
];

export function parseCustomExcludeLines(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildExcludeMatchers(
  customLines: string[],
): RegExp[] {
  const matchers: RegExp[] = [...BUILTIN_CALENDAR_EXCLUDE];
  for (const line of customLines) {
    try {
      matchers.push(new RegExp(line, "i"));
    } catch {
      const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      matchers.push(new RegExp(escaped, "i"));
    }
  }
  return matchers;
}

export function eventMatchesExclude(
  ev: Pick<CalendarEventView, "title">,
  matchers: RegExp[],
): boolean {
  const haystack = ev.title.trim();
  if (!haystack) return false;
  return matchers.some((re) => re.test(haystack));
}

export function filterCalendarEvents(
  events: CalendarEventView[],
  customLines: string[],
): CalendarEventView[] {
  const matchers = buildExcludeMatchers(customLines);
  return events.filter((ev) => !eventMatchesExclude(ev, matchers));
}

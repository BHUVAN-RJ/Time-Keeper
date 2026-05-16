export type QuickAddParsed = {
  title: string;
  estimateMinutes: number;
  importance: number;
  urgency: number;
  dueDate: string | null;
};

function formatOffset(days: number, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextWeekday(dayName: string, base = new Date()) {
  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const target = map[dayName.toLowerCase().slice(0, 3)];
  if (target == null) return null;
  const d = new Date(base);
  const cur = d.getDay();
  let delta = target - cur;
  if (delta <= 0) delta += 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Parse quick-add string per spec §6.15 D (regex only). */
export function parseQuickAdd(input: string): QuickAddParsed {
  let text = input.trim();
  let estimateMinutes = 30;
  let importance = 3;
  let urgency = 3;
  let dueDate: string | null = null;

  const est = text.match(/(\d+)\s*m(?:in(?:ute)?s?)?\b/i);
  if (est) {
    estimateMinutes = Math.max(1, parseInt(est[1]!, 10));
    text = text.replace(est[0], " ").trim();
  }

  if (/\bimportant\b/i.test(text)) {
    importance = 2;
    text = text.replace(/\bimportant\b/i, " ").trim();
  }
  if (/\burgent\b/i.test(text)) {
    urgency = 2;
    text = text.replace(/\burgent\b/i, " ").trim();
  }

  const dueToday = text.match(/\bdue\s+today\b/i);
  if (dueToday) {
    dueDate = formatOffset(0);
    text = text.replace(dueToday[0], " ").trim();
  }
  const dueTomorrow = text.match(/\bdue\s+tomorrow\b/i);
  if (dueTomorrow) {
    dueDate = formatOffset(1);
    text = text.replace(dueTomorrow[0], " ").trim();
  }
  const dueWeek = text.match(/\bdue\s+(mon|tue|wed|thu|fri|sat|sun)\b/i);
  if (dueWeek) {
    dueDate = nextWeekday(dueWeek[1]!);
    text = text.replace(dueWeek[0], " ").trim();
  }

  const title = text.replace(/\s+/g, " ").trim();
  if (!title) throw new Error("Could not parse a task title");

  return { title, estimateMinutes, importance, urgency, dueDate };
}

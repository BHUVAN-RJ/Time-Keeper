/** Default daily targets (minutes) keyed by seeded category name. */
export const DEFAULT_SCHEDULE_GOALS: Record<string, number> = {
  "Deep work": 120,
  "Regular work": 240,
  "Admin / shallow": 60,
  Chores: 60,
  "Learning": 60,
  Exercise: 30,
  Sleep: 0,
  "Free time (earned)": 0,
};

export const WORK_CATEGORY_NAMES = new Set([
  "Deep work",
  "Regular work",
  "Admin / shallow",
  "Learning",
]);

export const RED_DAY_THRESHOLD = 70;

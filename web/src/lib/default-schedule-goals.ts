import { COOKING_CLEANING_CATEGORY_NAME } from "./default-categories";

/** Default daily targets (minutes) keyed by seeded category name. */
export const DEFAULT_SCHEDULE_GOALS: Record<string, number> = {
  "Deep Work": 120,
  "Admin / Shallow": 60,
  [COOKING_CLEANING_CATEGORY_NAME]: 60,
  Exercise: 30,
};

export const WORK_CATEGORY_NAMES = new Set([
  "Deep Work",
  "Admin / Shallow",
  "Deep work",
  "Regular work",
  "Learning",
]);

export const RED_DAY_THRESHOLD = 70;

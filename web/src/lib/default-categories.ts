/** Legacy name before category simplification. */
export const LEGACY_CHORES_NAME = "Chores";

export const COOKING_CLEANING_CATEGORY_NAME = "Cooking / Cleaning";

/** @deprecated Use COOKING_CLEANING_CATEGORY_NAME */
export const CHORES_CATEGORY_NAME = COOKING_CLEANING_CATEGORY_NAME;

export const APPROVED_CATEGORY_NAMES = [
  "Deep Work",
  "Admin / Shallow",
  COOKING_CLEANING_CATEGORY_NAME,
  "Exercise",
] as const;

export const DEFAULT_CATEGORIES = [
  { name: "Deep Work", baseCreditRate: 15, isFreeTime: false, color: "#6fa66a" },
  { name: "Admin / Shallow", baseCreditRate: 5, isFreeTime: false, color: "#c9bf9f" },
  {
    name: COOKING_CLEANING_CATEGORY_NAME,
    baseCreditRate: 5,
    isFreeTime: false,
    color: "#8a9aa6",
  },
  { name: "Exercise", baseCreditRate: 8, isFreeTime: false, color: "#d9991f" },
] as const;

export const CHORES_HINT =
  "Daily upkeep — cook, clean, laundry, bath, etc.";

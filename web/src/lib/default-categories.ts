export const CHORES_CATEGORY_NAME = "Chores";

export const DEFAULT_CATEGORIES = [
  { name: "Deep work", baseCreditRate: 15, isFreeTime: false, color: "#6fa66a" },
  { name: "Regular work", baseCreditRate: 10, isFreeTime: false, color: "#8a8167" },
  { name: "Admin / shallow", baseCreditRate: 5, isFreeTime: false, color: "#c9bf9f" },
  { name: CHORES_CATEGORY_NAME, baseCreditRate: 5, isFreeTime: false, color: "#8a9aa6" },
  { name: "Learning", baseCreditRate: 12, isFreeTime: false, color: "#c87c2c" },
  { name: "Exercise", baseCreditRate: 8, isFreeTime: false, color: "#d9991f" },
  { name: "Sleep", baseCreditRate: 0, isFreeTime: false, color: "#5a5340" },
  {
    name: "Free time (earned)",
    baseCreditRate: 0,
    isFreeTime: true,
    color: "#f0b429",
  },
] as const;

/** Daily upkeep — cook, clean, laundry, bath, etc. */
export const CHORES_HINT =
  "Daily upkeep — cook, clean, laundry, bath, etc.";

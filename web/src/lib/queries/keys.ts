export const queryKeys = {
  today: {
    all: ["today"] as const,
  },
  tasks: {
    all: ["tasks"] as const,
  },
  habits: {
    manage: ["habits", "manage"] as const,
  },
  projects: {
    all: ["projects"] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  reminders: {
    all: ["reminders"] as const,
  },
  week: {
    all: ["week"] as const,
  },
} as const;

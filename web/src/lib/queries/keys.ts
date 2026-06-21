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
  amRundown: {
    all: ["amRundown"] as const,
  },
  shop: {
    all: ["shop"] as const,
  },
  stats: {
    all: ["stats"] as const,
  },
} as const;

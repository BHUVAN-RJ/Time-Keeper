import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Auth.js `user` table + app fields */
export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    compoundKey: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

export const authenticators = sqliteTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: integer("credentialBackedUp", {
      mode: "boolean",
    }).notNull(),
    transports: text("transports"),
  },
  (a) => ({
    compositePK: primaryKey({ columns: [a.userId, a.credentialID] }),
  }),
);

export const categories = sqliteTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseCreditRate: real("base_credit_rate").notNull(),
  color: text("color").notNull().default("#8a8167"),
  isFreeTime: integer("is_free_time", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["active", "paused", "completed", "retired"],
  })
    .notNull()
    .default("active"),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  retiredAt: integer("retired_at", { mode: "timestamp_ms" }),
  retiredReason: text("retired_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  estimateMinutes: integer("estimate_minutes").notNull(),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  dueDate: text("due_date"), // YYYY-MM-DD in user TZ
  scheduledDate: text("scheduled_date"),
  status: text("status", {
    enum: ["backlog", "scheduled", "in_progress", "completed", "dropped"],
  })
    .notNull()
    .default("backlog"),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  droppedAt: integer("dropped_at", { mode: "timestamp_ms" }),
  dropReason: text("drop_reason"),
  urgency: integer("urgency").notNull().default(3),
  importance: integer("importance").notNull().default(3),
  rescheduleCount: integer("reschedule_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reminders = sqliteTable("reminders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  remindAt: integer("remind_at", { mode: "timestamp_ms" }).notNull(),
  recurring: text("recurring", {
    enum: ["daily", "weekly", "monthly"],
  }),
  recurringDayOfWeek: integer("recurring_day_of_week"),
  linkedTaskId: text("linked_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  acknowledged: integer("acknowledged", { mode: "boolean" })
    .notNull()
    .default(false),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
  snoozedUntil: integer("snoozed_until", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tags = sqliteTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userNameUnique: uniqueIndex("tags_user_name").on(t.userId, t.name),
  }),
);

export const taskTags = sqliteTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.tagId] }),
  }),
);

export const timeBlockTags = sqliteTable(
  "time_block_tags",
  {
    timeBlockId: text("time_block_id")
      .notNull()
      .references(() => timeBlocks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.timeBlockId, t.tagId] }),
  }),
);

export const scheduleGoals = sqliteTable("schedule_goals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  targetMinutesPerDay: integer("target_minutes_per_day").notNull(),
  effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD
  effectiveTo: text("effective_to"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const dailyReviews = sqliteTable(
  "daily_reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    pmCompletedAt: integer("pm_completed_at", { mode: "timestamp_ms" }),
    mood: integer("mood"),
    notes: text("notes"),
    tomorrowsPlanJson: text("tomorrows_plan_json"),
    amSeenAt: integer("am_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    userDateUnique: uniqueIndex("daily_reviews_user_date").on(t.userId, t.date),
  }),
);

export const dayStatus = sqliteTable(
  "day_status",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    goalHitPercent: real("goal_hit_percent"),
    isRed: integer("is_red", { mode: "boolean" }).notNull().default(false),
    creditsEarned: real("credits_earned").notNull().default(0),
    creditsSpent: real("credits_spent").notNull().default(0),
    creditsOverworkBonus: real("credits_overwork_bonus").notNull().default(0),
    creditsWeeklyBonus: real("credits_weekly_bonus").notNull().default(0),
    isOffDay: integer("is_off_day", { mode: "boolean" }).notNull().default(false),
    isVacation: integer("is_vacation", { mode: "boolean" }).notNull().default(false),
    habitsCompletionPercent: real("habits_completion_percent"),
    productivityScore: integer("productivity_score"),
    scoreVsAvgDelta: real("score_vs_avg_delta"),
    /** Derived in-window untracked minutes for the (closed) business day. */
    wastedMinutes: integer("wasted_minutes").notNull().default(0),
    /** True when finalized by silent 4 AM reconciliation rather than manual End Day. */
    autoClosed: integer("auto_closed", { mode: "boolean" }).notNull().default(false),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.date] }),
  }),
);

export const timeBlocks = sqliteTable(
  "time_blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }),
    label: text("label"),
    quality: text("quality"), // useful | meh | wasted | null while running
    notes: text("notes"),
    manualEntry: integer("manual_entry", { mode: "boolean" }).notNull().default(false),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    habitCompletionId: text("habit_completion_id"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    randomBonusApplied: integer("random_bonus_applied", { mode: "boolean" })
      .notNull()
      .default(false),
    statedIntent: text("stated_intent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    oneRunningPerUser: uniqueIndex("time_blocks_user_running_unique")
      .on(t.userId)
      .where(sql`${t.endAt} IS NULL`),
  }),
);

export const habits = sqliteTable("habits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  targetPerDay: integer("target_per_day").notNull().default(1),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const habitCompletions = sqliteTable("habit_completions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  habitId: text("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  count: integer("count").notNull().default(1),
  notes: text("notes"),
  linkedTimeBlockId: text("linked_time_block_id").references(
    () => timeBlocks.id,
    { onDelete: "set null" },
  ),
});

export const habitStreaks = sqliteTable(
  "habit_streaks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    daysHitLast30: integer("days_hit_last_30").notNull().default(0),
    lastCompletedDate: text("last_completed_date"),
    freezesAvailable: integer("freezes_available").notNull().default(2),
    freezesUsedThisMonth: integer("freezes_used_this_month")
      .notNull()
      .default(0),
    freezeMonthKey: text("freeze_month_key"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    habitUnique: uniqueIndex("habit_streaks_habit_id").on(t.habitId),
  }),
);

/** Per-calendar-day rollup for heatmap, freezes, and streak recompute. */
export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStarting: text("week_starting").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    commitmentsJson: text("commitments_json"),
    droppedProjectId: text("dropped_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    habitChangeNote: text("habit_change_note"),
    notes: text("notes"),
  },
  (t) => ({
    userWeekUnique: uniqueIndex("weekly_reviews_user_week").on(
      t.userId,
      t.weekStarting,
    ),
  }),
);

export const productivityScores = sqliteTable(
  "productivity_scores",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    score: integer("score").notNull(),
    breakdownJson: text("breakdown_json"),
    vsRollingAvg: real("vs_rolling_avg"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.date] }),
  }),
);

export const offDayBalance = sqliteTable("off_day_balance", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  available: integer("available").notNull().default(0),
  lifetimeForfeited: integer("lifetime_forfeited").notNull().default(0),
  lastRecalcDate: text("last_recalc_date"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const offDayUses = sqliteTable(
  "off_day_uses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userDateUnique: uniqueIndex("off_day_uses_user_date").on(t.userId, t.date),
  }),
);

export const overworkBank = sqliteTable("overwork_bank", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  unbankedMinutes: integer("unbanked_minutes").notNull().default(0),
  bankedFreezeCredits: integer("banked_freeze_credits").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const habitDaily = sqliteTable(
  "habit_daily",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    completionCount: integer("completion_count").notNull().default(0),
    freezeUsed: integer("freeze_used", { mode: "boolean" })
      .notNull()
      .default(false),
    offDaySkipped: integer("off_day_skipped", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.habitId, t.date] }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  categories: many(categories),
  tasks: many(tasks),
  scheduleGoals: many(scheduleGoals),
  dayStatuses: many(dayStatus),
  dailyReviews: many(dailyReviews),
  timeBlocks: many(timeBlocks),
  habits: many(habits),
  habitCompletions: many(habitCompletions),
  projects: many(projects),
  weeklyReviews: many(weeklyReviews),
  reminders: many(reminders),
  tags: many(tags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  taskTags: many(taskTags),
  timeBlockTags: many(timeBlockTags),
}));

export const dailyReviewsRelations = relations(dailyReviews, ({ one }) => ({
  user: one(users, { fields: [dailyReviews.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(tasks),
  timeBlocks: many(timeBlocks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  timeBlocks: many(timeBlocks),
}));

export const scheduleGoalsRelations = relations(scheduleGoals, ({ one }) => ({
  user: one(users, { fields: [scheduleGoals.userId], references: [users.id] }),
  category: one(categories, {
    fields: [scheduleGoals.categoryId],
    references: [categories.id],
  }),
}));

export const dayStatusRelations = relations(dayStatus, ({ one }) => ({
  user: one(users, { fields: [dayStatus.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  timeBlocks: many(timeBlocks),
}));

export const timeBlocksRelations = relations(timeBlocks, ({ one }) => ({
  user: one(users, { fields: [timeBlocks.userId], references: [users.id] }),
  category: one(categories, {
    fields: [timeBlocks.categoryId],
    references: [categories.id],
  }),
  task: one(tasks, {
    fields: [timeBlocks.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [timeBlocks.projectId],
    references: [projects.id],
  }),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  category: one(categories, {
    fields: [habits.categoryId],
    references: [categories.id],
  }),
  completions: many(habitCompletions),
  streak: one(habitStreaks, {
    fields: [habits.id],
    references: [habitStreaks.habitId],
  }),
  daily: many(habitDaily),
}));

export const habitCompletionsRelations = relations(
  habitCompletions,
  ({ one }) => ({
    user: one(users, {
      fields: [habitCompletions.userId],
      references: [users.id],
    }),
    habit: one(habits, {
      fields: [habitCompletions.habitId],
      references: [habits.id],
    }),
    timeBlock: one(timeBlocks, {
      fields: [habitCompletions.linkedTimeBlockId],
      references: [timeBlocks.id],
    }),
  }),
);

export const habitStreaksRelations = relations(habitStreaks, ({ one }) => ({
  habit: one(habits, {
    fields: [habitStreaks.habitId],
    references: [habits.id],
  }),
}));

export const habitDailyRelations = relations(habitDaily, ({ one }) => ({
  user: one(users, { fields: [habitDaily.userId], references: [users.id] }),
  habit: one(habits, {
    fields: [habitDaily.habitId],
    references: [habits.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
  task: one(tasks, {
    fields: [reminders.linkedTaskId],
    references: [tasks.id],
  }),
}));

export const googleCalendarAccounts = sqliteTable(
  "google_calendar_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleEmail: text("google_email").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userEmailUnique: uniqueIndex("google_calendar_accounts_user_email").on(
      t.userId,
      t.googleEmail,
    ),
  }),
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Extra lines matched against event titles (built-in rules always apply). */
  calendarExcludePatterns: text("calendar_exclude_patterns"),
  /** 0–100: share of overwork minutes converted to credits (rest → freeze bank). */
  overworkCreditsPercent: real("overwork_credits_percent").notNull().default(50),
  /** 0 = off; 30 / 60 / 90 = body-doubling ping interval (minutes). */
  bodyDoublingIntervalMinutes: integer("body_doubling_interval_minutes")
    .notNull()
    .default(0),
  /** When false, hide tag pickers and month tag breakdown. */
  tagsEnabled: integer("tags_enabled", { mode: "boolean" }).notNull().default(true),
  /** When false, hide reminder bell, banner, and AM rundown reminders. */
  remindersEnabled: integer("reminders_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Start of the active window (HH:MM, 24h, user TZ) for wasted-time evaluation. */
  activeWindowStart: text("active_window_start").notNull().default("09:00"),
  /** End of the active window (HH:MM, 24h, user TZ). <= start ⇒ crosses midnight. */
  activeWindowEnd: text("active_window_end").notNull().default("21:00"),
  /** Last user activity while a timer was running (for idle auto-stop). */
  timerLastSeenAt: integer("timer_last_seen_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const googleCalendarEventCache = sqliteTable(
  "google_calendar_event_cache",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rangeStart: text("range_start").notNull(),
    rangeEnd: text("range_end").notNull(),
    eventsJson: text("events_json").notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.userId, t.rangeStart, t.rangeEnd],
    }),
  }),
);

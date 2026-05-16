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
  projectId: text("project_id"),
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
    isOffDay: integer("is_off_day", { mode: "boolean" }).notNull().default(false),
    isVacation: integer("is_vacation", { mode: "boolean" }).notNull().default(false),
    habitsCompletionPercent: real("habits_completion_percent"),
    productivityScore: integer("productivity_score"),
    scoreVsAvgDelta: real("score_vs_avg_delta"),
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
    quality: text("quality"), // useful | chores | meh | wasted | null while running
    notes: text("notes"),
    manualEntry: integer("manual_entry", { mode: "boolean" }).notNull().default(false),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    habitCompletionId: text("habit_completion_id"),
    projectId: text("project_id"),
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

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  categories: many(categories),
  tasks: many(tasks),
  scheduleGoals: many(scheduleGoals),
  dayStatuses: many(dayStatus),
  dailyReviews: many(dailyReviews),
  timeBlocks: many(timeBlocks),
}));

export const dailyReviewsRelations = relations(dailyReviews, ({ one }) => ({
  user: one(users, { fields: [dailyReviews.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
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
}));

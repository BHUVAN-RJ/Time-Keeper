CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_starting` text NOT NULL,
	`completed_at` integer,
	`commitments_json` text,
	`dropped_project_id` text,
	`habit_change_note` text,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dropped_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reviews_user_week` ON `weekly_reviews` (`user_id`,`week_starting`);
--> statement-breakpoint
CREATE TABLE `productivity_scores` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`score` integer NOT NULL,
	`breakdown_json` text,
	`vs_rolling_avg` real,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `off_day_balance` (
	`user_id` text PRIMARY KEY NOT NULL,
	`available` integer DEFAULT 0 NOT NULL,
	`lifetime_forfeited` integer DEFAULT 0 NOT NULL,
	`last_recalc_date` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `off_day_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `off_day_uses_user_date` ON `off_day_uses` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE `overwork_bank` (
	`user_id` text PRIMARY KEY NOT NULL,
	`unbanked_minutes` integer DEFAULT 0 NOT NULL,
	`banked_freeze_credits` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `day_status` ADD `credits_weekly_bonus` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `overwork_credits_percent` real DEFAULT 50 NOT NULL;

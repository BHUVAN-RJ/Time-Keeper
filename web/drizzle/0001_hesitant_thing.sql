CREATE TABLE `day_status` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`goal_hit_percent` real,
	`is_red` integer DEFAULT false NOT NULL,
	`credits_earned` real DEFAULT 0 NOT NULL,
	`credits_spent` real DEFAULT 0 NOT NULL,
	`credits_overwork_bonus` real DEFAULT 0 NOT NULL,
	`is_off_day` integer DEFAULT false NOT NULL,
	`is_vacation` integer DEFAULT false NOT NULL,
	`habits_completion_percent` real,
	`productivity_score` integer,
	`score_vs_avg_delta` real,
	`ended_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schedule_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`target_minutes_per_day` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category_id` text,
	`project_id` text,
	`estimate_minutes` integer NOT NULL,
	`actual_minutes` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`scheduled_date` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`completed_at` integer,
	`dropped_at` integer,
	`drop_reason` text,
	`urgency` integer DEFAULT 3 NOT NULL,
	`importance` integer DEFAULT 3 NOT NULL,
	`reschedule_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `time_blocks` ALTER COLUMN "task_id" TO "task_id" text REFERENCES tasks(id) ON DELETE set null ON UPDATE no action;
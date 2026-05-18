CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`remind_at` integer NOT NULL,
	`recurring` text,
	`recurring_day_of_week` integer,
	`linked_task_id` text,
	`acknowledged` integer DEFAULT false NOT NULL,
	`acknowledged_at` integer,
	`snoozed_until` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);

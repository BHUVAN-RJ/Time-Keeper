CREATE TABLE `daily_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`pm_completed_at` integer,
	`mood` integer,
	`notes` text,
	`tomorrows_plan_json` text,
	`am_seen_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reviews_user_date` ON `daily_reviews` (`user_id`,`date`);
CREATE TABLE `google_calendar_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`google_email` text NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_accounts_user_email` ON `google_calendar_accounts` (`user_id`,`google_email`);--> statement-breakpoint
CREATE TABLE `google_calendar_event_cache` (
	`user_id` text NOT NULL,
	`range_start` text NOT NULL,
	`range_end` text NOT NULL,
	`events_json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `range_start`, `range_end`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

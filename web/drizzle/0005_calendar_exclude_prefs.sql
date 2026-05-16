CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`calendar_exclude_patterns` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

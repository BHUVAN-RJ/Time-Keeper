ALTER TABLE `day_status` ADD `wasted_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `day_status` ADD `auto_closed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `active_window_start` text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `active_window_end` text DEFAULT '21:00' NOT NULL;

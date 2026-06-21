ALTER TABLE `time_blocks` ADD `habit_id` text;--> statement-breakpoint
ALTER TABLE `time_blocks` ADD `focus_target_minutes` integer;--> statement-breakpoint
CREATE TABLE `shop_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cost_points` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_items_slug_unique` ON `shop_items` (`slug`);--> statement-breakpoint
CREATE TABLE `shop_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shop_item_id` text NOT NULL,
	`points_spent` integer NOT NULL,
	`redeemed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shop_item_id`) REFERENCES `shop_items`(`id`) ON UPDATE no action ON DELETE no action
);

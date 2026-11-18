CREATE TABLE `tickets` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_entry_unique` ON `tickets` (`entry`);--> statement-breakpoint
ALTER TABLE `entries` ADD `accepted_by` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `admitted_at` integer;
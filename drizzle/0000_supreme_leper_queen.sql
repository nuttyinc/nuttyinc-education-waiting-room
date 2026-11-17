CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`joined` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`open` integer DEFAULT 1 NOT NULL
);

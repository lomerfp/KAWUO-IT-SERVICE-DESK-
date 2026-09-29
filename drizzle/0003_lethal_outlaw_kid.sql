CREATE TABLE `ticket_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`requester_email` text NOT NULL,
	`requester_name` text NOT NULL,
	`resolution_at` text NOT NULL,
	`satisfied` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ticket_feedback_resolution` ON `ticket_feedback` (`ticket_id`,`resolution_at`);--> statement-breakpoint
CREATE INDEX `idx_ticket_feedback_created` ON `ticket_feedback` (`created_at`);
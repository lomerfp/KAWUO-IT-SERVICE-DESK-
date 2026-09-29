CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`requester_name` text NOT NULL,
	`requester_email` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`priority` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`resolution_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	`is_sample` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tickets_requester_created` ON `tickets` (`requester_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_status_created` ON `tickets` (`status`,`created_at`);
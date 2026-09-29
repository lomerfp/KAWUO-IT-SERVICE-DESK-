CREATE TABLE `remote_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`requester_email` text NOT NULL,
	`requester_name` text NOT NULL,
	`device` text NOT NULL,
	`issue` text NOT NULL,
	`ticket_id` text,
	`status` text DEFAULT 'Requested' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`consent_acknowledged` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_remote_sessions_requester_created` ON `remote_sessions` (`requester_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_remote_sessions_status_created` ON `remote_sessions` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `staff_members` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'Staff' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`self_requested` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_staff_members_active_role` ON `staff_members` (`active`,`role`);
CREATE INDEX `idx_tickets_created` ON `tickets` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_assignee_created` ON `tickets` (`assignee`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_category_created` ON `tickets` (`category`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_priority_created` ON `tickets` (`priority`,`created_at`);
ALTER TABLE `settings` ADD `check_timeout_seconds` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `check_max_retries` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `check_retry_delay_seconds` integer DEFAULT 5 NOT NULL;
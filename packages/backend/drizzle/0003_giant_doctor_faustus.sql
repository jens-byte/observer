CREATE INDEX IF NOT EXISTS `checks_site_id_idx` ON `checks` (`site_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `checks_site_checked_idx` ON `checks` (`site_id`,`checked_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sites_workspace_id_idx` ON `sites` (`workspace_id`);
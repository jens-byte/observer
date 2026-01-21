CREATE INDEX IF NOT EXISTS `checks_checked_at_idx` ON `checks` (`checked_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cms_info_site_id_idx` ON `cms_info` (`site_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dns_info_site_id_idx` ON `dns_info` (`site_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ssl_info_site_id_idx` ON `ssl_info` (`site_id`);
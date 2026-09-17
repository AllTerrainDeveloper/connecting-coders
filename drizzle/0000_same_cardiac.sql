CREATE TABLE `github_oauth_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`viewer` text NOT NULL,
	`verifier` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `github_attempts_expiry` ON `github_oauth_attempts` (`expires`);--> statement-breakpoint
CREATE TABLE `github_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`viewer` text NOT NULL,
	`token` text NOT NULL,
	`login` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `github_sessions_expiry` ON `github_sessions` (`expires`);
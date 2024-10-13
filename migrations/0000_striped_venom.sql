CREATE TABLE `Tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`replyMessageId` integer NOT NULL,
	`notificationTime` text NOT NULL,
	`userId` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegramId` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_telegramId_unique` ON `Users` (`telegramId`);
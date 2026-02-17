CREATE TABLE `generation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`resourceType` enum('courseware','exam','lesson_plan','transcript','lecture_script') NOT NULL,
	`title` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`parameters` json,
	`content` text NOT NULL,
	`knowledgeFileIds` json,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resourceType` enum('courseware','exam','lesson_plan','transcript','lecture_script') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`subject` text,
	`grade` text,
	`tags` json,
	`isPublic` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `resource_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `school` text;--> statement-breakpoint
ALTER TABLE `users` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `users` ADD `grade` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;
CREATE TABLE `student_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`batchTitle` varchar(255) NOT NULL,
	`commentType` enum('final_term','homework','daily','custom') NOT NULL,
	`students` json NOT NULL,
	`totalCount` int NOT NULL,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_comments_id` PRIMARY KEY(`id`)
);

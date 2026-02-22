CREATE TABLE `collaboration_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `generationId` int NOT NULL,
  `ownerId` int NOT NULL,
  `participants` json NOT NULL,
  `docContent` text NOT NULL,
  `revision` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `collaboration_sessions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `resource_comments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `generationId` int NOT NULL,
  `anchor` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `authorId` int NOT NULL,
  `parentId` int,
  `status` enum('open','resolved') NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `resource_comments_id` PRIMARY KEY(`id`)
);

CREATE TABLE `resource_presence` (
  `id` int AUTO_INCREMENT NOT NULL,
  `generationId` int NOT NULL,
  `userId` int NOT NULL,
  `state` enum('online','idle','offline') NOT NULL DEFAULT 'online',
  `cursorAnchor` varchar(255),
  `lastSeenAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `resource_presence_id` PRIMARY KEY(`id`)
);

CREATE UNIQUE INDEX `collaboration_sessions_generation_idx` ON `collaboration_sessions` (`generationId`);
CREATE INDEX `resource_comments_generation_idx` ON `resource_comments` (`generationId`);
CREATE INDEX `resource_comments_parent_idx` ON `resource_comments` (`parentId`);
CREATE UNIQUE INDEX `resource_presence_generation_user_idx` ON `resource_presence` (`generationId`, `userId`);
CREATE INDEX `resource_presence_last_seen_idx` ON `resource_presence` (`lastSeenAt`);

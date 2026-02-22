ALTER TABLE `knowledge_files`
  ADD COLUMN `folderId` int;

ALTER TABLE `generation_history`
  ADD COLUMN `folderId` int;

CREATE TABLE `folders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `parentId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `folders_id` PRIMARY KEY(`id`)
);

CREATE TABLE `resource_tags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(128) NOT NULL,
  `color` varchar(32),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `resource_tags_id` PRIMARY KEY(`id`)
);

CREATE TABLE `knowledge_file_tags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `knowledgeFileId` int NOT NULL,
  `tagId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `knowledge_file_tags_id` PRIMARY KEY(`id`)
);

CREATE TABLE `generation_history_tags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `generationId` int NOT NULL,
  `tagId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `generation_history_tags_id` PRIMARY KEY(`id`)
);

CREATE TABLE `generation_history_versions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `generationId` int NOT NULL,
  `versionNo` int NOT NULL,
  `contentSnapshot` text NOT NULL,
  `contentDiff` text,
  `editedBy` int NOT NULL,
  `changeSummary` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `generation_history_versions_id` PRIMARY KEY(`id`)
);

CREATE INDEX `folders_user_idx` ON `folders` (`userId`);
CREATE INDEX `folders_parent_idx` ON `folders` (`parentId`);
CREATE INDEX `resource_tags_user_idx` ON `resource_tags` (`userId`);
CREATE UNIQUE INDEX `resource_tags_user_name_idx` ON `resource_tags` (`userId`, `name`);
CREATE INDEX `knowledge_file_tags_file_idx` ON `knowledge_file_tags` (`knowledgeFileId`);
CREATE INDEX `knowledge_file_tags_tag_idx` ON `knowledge_file_tags` (`tagId`);
CREATE UNIQUE INDEX `knowledge_file_tags_unique` ON `knowledge_file_tags` (`knowledgeFileId`, `tagId`);
CREATE INDEX `generation_history_tags_generation_idx` ON `generation_history_tags` (`generationId`);
CREATE INDEX `generation_history_tags_tag_idx` ON `generation_history_tags` (`tagId`);
CREATE UNIQUE INDEX `generation_history_tags_unique` ON `generation_history_tags` (`generationId`, `tagId`);
CREATE UNIQUE INDEX `generation_versions_unique` ON `generation_history_versions` (`generationId`, `versionNo`);

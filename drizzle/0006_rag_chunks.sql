-- Add text extraction and RAG fields to knowledge_files
ALTER TABLE `knowledge_files` ADD COLUMN `textContent` text;
ALTER TABLE `knowledge_files` ADD COLUMN `chunkCount` int NOT NULL DEFAULT 0;
ALTER TABLE `knowledge_files` ADD COLUMN `processingStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending';
ALTER TABLE `knowledge_files` ADD COLUMN `processingError` text;

-- Create knowledge_chunks table for RAG retrieval
CREATE TABLE `knowledge_chunks` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `knowledgeFileId` int NOT NULL,
  `userId` int NOT NULL,
  `chunkIndex` int NOT NULL,
  `content` text NOT NULL,
  `charCount` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_chunks_file` (`knowledgeFileId`),
  INDEX `idx_chunks_user` (`userId`)
);

-- Add retrievalContext to generation_history
ALTER TABLE `generation_history` ADD COLUMN `retrievalContext` text;

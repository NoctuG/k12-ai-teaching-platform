ALTER TABLE `knowledge_chunks` ADD COLUMN `embeddingModel` varchar(128);
ALTER TABLE `knowledge_chunks` ADD COLUMN `embeddingDim` int;
ALTER TABLE `knowledge_chunks` ADD COLUMN `embedding` json;
ALTER TABLE `knowledge_chunks` ADD COLUMN `embeddingStatus` enum('pending','completed','failed') NOT NULL DEFAULT 'pending';
ALTER TABLE `knowledge_chunks` ADD COLUMN `embeddingError` text;

CREATE INDEX `idx_chunks_embedding_status` ON `knowledge_chunks` (`embeddingStatus`);

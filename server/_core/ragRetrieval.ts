import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { knowledgeChunks } from "../../drizzle/schema";

export interface RetrievedChunk {
  fileId: number;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
}

/**
 * Tokenize text into terms for keyword matching.
 * Handles both Chinese (character/bigram) and English (word) segmentation.
 */
function tokenize(text: string): string[] {
  const terms: string[] = [];

  // Extract English words (2+ chars)
  const englishWords = text.toLowerCase().match(/[a-z]{2,}/g);
  if (englishWords) {
    terms.push(...englishWords);
  }

  // Extract Chinese characters and bigrams
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  if (chineseChars) {
    // Single characters
    terms.push(...chineseChars);
    // Bigrams for better matching
    for (let i = 0; i < chineseChars.length - 1; i++) {
      terms.push(chineseChars[i] + chineseChars[i + 1]);
    }
  }

  // Extract numbers
  const numbers = text.match(/\d+/g);
  if (numbers) {
    terms.push(...numbers);
  }

  return terms;
}

/**
 * Compute a simple keyword-overlap score between query and chunk.
 */
function computeScore(queryTerms: Set<string>, chunkContent: string): number {
  const chunkTerms = tokenize(chunkContent);
  if (chunkTerms.length === 0) return 0;

  let matchCount = 0;
  for (const term of chunkTerms) {
    if (queryTerms.has(term)) {
      matchCount++;
    }
  }

  // Normalize by chunk terms length to avoid long-chunk bias
  return matchCount / Math.sqrt(chunkTerms.length);
}

/**
 * Retrieve relevant chunks from selected knowledge files based on the query.
 *
 * @param knowledgeFileIds - IDs of knowledge files selected by the user
 * @param query - The user's prompt/question
 * @param fileNameMap - Map of file ID to file name for context
 * @param maxChunks - Maximum number of chunks to return
 * @param maxChars - Maximum total characters to return
 */
export async function retrieveRelevantChunks(
  knowledgeFileIds: number[],
  query: string,
  fileNameMap: Record<number, string>,
  maxChunks = 20,
  maxChars = 6000
): Promise<RetrievedChunk[]> {
  if (knowledgeFileIds.length === 0) {
    return [];
  }

  const db = await getDb();
  if (!db) return [];

  // Fetch all chunks for the selected files
  const allChunks = await db
    .select()
    .from(knowledgeChunks)
    .where(inArray(knowledgeChunks.knowledgeFileId, knowledgeFileIds));

  if (allChunks.length === 0) {
    return [];
  }

  // Tokenize the query
  const queryTerms = new Set(tokenize(query));

  // Score each chunk
  const scored: RetrievedChunk[] = allChunks.map(chunk => ({
    fileId: chunk.knowledgeFileId,
    fileName: fileNameMap[chunk.knowledgeFileId] || "未知文件",
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    score: computeScore(queryTerms, chunk.content),
  }));

  // Sort by score descending, then by chunk index for tie-breaking
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.fileId !== b.fileId) return a.fileId - b.fileId;
    return a.chunkIndex - b.chunkIndex;
  });

  // Select top chunks within budget
  const selected: RetrievedChunk[] = [];
  let totalChars = 0;

  for (const chunk of scored) {
    if (selected.length >= maxChunks) break;
    if (totalChars + chunk.content.length > maxChars) break;
    // Skip chunks with zero score only if we already have some results
    if (chunk.score === 0 && selected.length > 0) break;

    selected.push(chunk);
    totalChars += chunk.content.length;
  }

  // If no scored chunks were found, include first few chunks from each file
  // (fallback for when query terms don't overlap with content)
  if (selected.length === 0 && allChunks.length > 0) {
    const byFile: Record<number, typeof allChunks> = {};
    for (const chunk of allChunks) {
      if (!byFile[chunk.knowledgeFileId]) {
        byFile[chunk.knowledgeFileId] = [];
      }
      byFile[chunk.knowledgeFileId].push(chunk);
    }

    for (const fileIdStr of Object.keys(byFile)) {
      const fileId = Number(fileIdStr);
      const chunks = byFile[fileId];
      const sorted = chunks.sort((a: typeof allChunks[0], b: typeof allChunks[0]) => a.chunkIndex - b.chunkIndex);
      for (const chunk of sorted.slice(0, 3)) {
        if (totalChars + chunk.content.length > maxChars) break;
        selected.push({
          fileId: chunk.knowledgeFileId,
          fileName: fileNameMap[chunk.knowledgeFileId] || "未知文件",
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: 0,
        });
        totalChars += chunk.content.length;
      }
    }
  }

  return selected;
}

/**
 * Format retrieved chunks into a context string for the LLM prompt.
 */
export function formatRetrievalContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  // Group chunks by file
  const byFile: Record<string, RetrievedChunk[]> = {};
  for (const chunk of chunks) {
    const key = chunk.fileName;
    if (!byFile[key]) {
      byFile[key] = [];
    }
    byFile[key].push(chunk);
  }

  const sections: string[] = [];
  for (const fileName of Object.keys(byFile)) {
    const fileChunks = byFile[fileName];
    // Sort by chunk index within each file
    fileChunks.sort((a: RetrievedChunk, b: RetrievedChunk) => a.chunkIndex - b.chunkIndex);

    const chunkTexts = fileChunks.map((c: RetrievedChunk) => c.content).join("\n\n");
    sections.push(`【参考资料：${fileName}】\n${chunkTexts}`);
  }

  return `以下是从教师上传的知识库文件中检索到的相关内容，请在生成时参考这些材料：\n\n${sections.join("\n\n---\n\n")}`;
}

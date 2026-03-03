import { inArray } from "drizzle-orm";
import { knowledgeChunks } from "../../drizzle/schema";
import { getDb } from "../db";
import { embedText } from "./embedding";

export interface RetrievedChunk {
  fileId: number;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
  vectorScore: number;
  keywordScore: number;
}

export type RetrievalMode = "hybrid" | "keyword";

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  mode: RetrievalMode;
}

export interface RetrievalCandidate {
  knowledgeFileId: number;
  chunkIndex: number;
  content: string;
  embedding?: number[] | null;
}

const VECTOR_WEIGHT = 0.65;
const KEYWORD_WEIGHT = 0.35;

function tokenize(text: string): string[] {
  const terms: string[] = [];
  const englishWords = text.toLowerCase().match(/[a-z]{2,}/g);
  if (englishWords) terms.push(...englishWords);

  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  if (chineseChars) {
    terms.push(...chineseChars);
    for (let i = 0; i < chineseChars.length - 1; i++) {
      terms.push(chineseChars[i] + chineseChars[i + 1]);
    }
  }

  const numbers = text.match(/\d+/g);
  if (numbers) terms.push(...numbers);

  return terms;
}

function computeKeywordScore(queryTerms: Set<string>, chunkContent: string): number {
  const chunkTerms = tokenize(chunkContent);
  if (chunkTerms.length === 0) return 0;

  let matchCount = 0;
  for (const term of chunkTerms) {
    if (queryTerms.has(term)) matchCount += 1;
  }

  return matchCount / Math.sqrt(chunkTerms.length);
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const denominator = norm(a) * norm(b);
  if (denominator === 0) return 0;
  return dot(a, b) / denominator;
}

function normalizeToUnitRange(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(v => (v > 0 ? 1 : 0));
  }
  return values.map(v => (v - min) / (max - min));
}

export function rankChunksForQuery(params: {
  query: string;
  chunks: RetrievalCandidate[];
  fileNameMap: Record<number, string>;
  queryEmbedding?: number[];
  maxChunks?: number;
  maxChars?: number;
}): RetrievalResult {
  const { query, chunks, fileNameMap, queryEmbedding, maxChunks = 20, maxChars = 6000 } = params;
  const queryTerms = new Set(tokenize(query));

  const keywordRaw = chunks.map(chunk => computeKeywordScore(queryTerms, chunk.content));
  const keywordNorm = normalizeToUnitRange(keywordRaw);

  const canUseVector =
    Array.isArray(queryEmbedding) &&
    queryEmbedding.length > 0 &&
    chunks.some(chunk => Array.isArray(chunk.embedding) && chunk.embedding.length > 0);

  const vectorRaw = canUseVector
    ? chunks.map(chunk => {
        if (!chunk.embedding || chunk.embedding.length === 0) return -1;
        return cosineSimilarity(queryEmbedding!, chunk.embedding);
      })
    : chunks.map(() => 0);
  const vectorNorm = canUseVector
    ? normalizeToUnitRange(vectorRaw.map(v => Math.max(-1, Math.min(1, v))))
    : chunks.map(() => 0);

  const scored: RetrievedChunk[] = chunks.map((chunk, i) => {
    const vectorScore = canUseVector ? vectorNorm[i] : 0;
    const keywordScore = keywordNorm[i];
    const score = canUseVector
      ? vectorScore * VECTOR_WEIGHT + keywordScore * KEYWORD_WEIGHT
      : keywordScore;

    return {
      fileId: chunk.knowledgeFileId,
      fileName: fileNameMap[chunk.knowledgeFileId] || "未知文件",
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score,
      vectorScore,
      keywordScore,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.fileId !== b.fileId) return a.fileId - b.fileId;
    return a.chunkIndex - b.chunkIndex;
  });

  const selected: RetrievedChunk[] = [];
  let totalChars = 0;

  for (const chunk of scored) {
    if (selected.length >= maxChunks) break;
    if (totalChars + chunk.content.length > maxChars) break;
    if (chunk.score === 0 && selected.length > 0) break;

    selected.push(chunk);
    totalChars += chunk.content.length;
  }

  if (selected.length === 0 && chunks.length > 0) {
    const byFile: Record<number, RetrievalCandidate[]> = {};
    for (const chunk of chunks) {
      if (!byFile[chunk.knowledgeFileId]) byFile[chunk.knowledgeFileId] = [];
      byFile[chunk.knowledgeFileId].push(chunk);
    }

    for (const fileId of Object.keys(byFile).map(Number)) {
      const sorted = byFile[fileId].sort((a, b) => a.chunkIndex - b.chunkIndex);
      for (const chunk of sorted.slice(0, 3)) {
        if (totalChars + chunk.content.length > maxChars) break;
        selected.push({
          fileId: chunk.knowledgeFileId,
          fileName: fileNameMap[chunk.knowledgeFileId] || "未知文件",
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: 0,
          vectorScore: 0,
          keywordScore: 0,
        });
        totalChars += chunk.content.length;
      }
    }
  }

  return {
    chunks: selected,
    mode: canUseVector ? "hybrid" : "keyword",
  };
}

export async function retrieveRelevantChunks(
  knowledgeFileIds: number[],
  query: string,
  fileNameMap: Record<number, string>,
  maxChunks = 20,
  maxChars = 6000
): Promise<RetrievalResult> {
  if (knowledgeFileIds.length === 0) return { chunks: [], mode: "keyword" };

  const db = await getDb();
  if (!db) return { chunks: [], mode: "keyword" };

  const allChunks = await db
    .select()
    .from(knowledgeChunks)
    .where(inArray(knowledgeChunks.knowledgeFileId, knowledgeFileIds));

  if (allChunks.length === 0) {
    return { chunks: [], mode: "keyword" };
  }

  let queryEmbedding: number[] | undefined;
  try {
    queryEmbedding = await embedText(query);
  } catch (error) {
    console.warn("[RAG] Query embedding unavailable, fallback to keyword retrieval", error);
  }

  return rankChunksForQuery({
    query,
    chunks: allChunks,
    fileNameMap,
    queryEmbedding,
    maxChunks,
    maxChars,
  });
}

export function formatRetrievalContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const byFile: Record<string, RetrievedChunk[]> = {};
  for (const chunk of chunks) {
    if (!byFile[chunk.fileName]) byFile[chunk.fileName] = [];
    byFile[chunk.fileName].push(chunk);
  }

  const sections: string[] = [];
  for (const fileName of Object.keys(byFile)) {
    const fileChunks = byFile[fileName].sort((a, b) => a.chunkIndex - b.chunkIndex);
    sections.push(`【参考资料：${fileName}】\n${fileChunks.map(c => c.content).join("\n\n")}`);
  }

  return `以下是从教师上传的知识库文件中检索到的相关内容，请在生成时参考这些材料：\n\n${sections.join("\n\n---\n\n")}`;
}

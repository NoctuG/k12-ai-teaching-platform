import { describe, expect, it } from "vitest";
import { rankChunksForQuery } from "./_core/ragRetrieval";

const fileNameMap = { 1: "science.txt" };

const chunks = [
  {
    knowledgeFileId: 1,
    chunkIndex: 0,
    content: "Photovoltaic cells convert sunlight into electrical energy.",
    embedding: [0.95, 0.05],
  },
  {
    knowledgeFileId: 1,
    chunkIndex: 1,
    content: "A worksheet mentions solar panel power and energy terms for vocabulary drills.",
    embedding: [-0.8, 0.1],
  },
  {
    knowledgeFileId: 1,
    chunkIndex: 2,
    content: "Battery polarity and wires form a simple closed circuit.",
    embedding: [0.1, 0.95],
  },
];

describe("rankChunksForQuery hybrid retrieval", () => {
  it("improves ranking for synonym query over keyword-only", () => {
    const query = "How does a solar panel generate electricity";
    const keywordOnly = rankChunksForQuery({ query, chunks, fileNameMap });
    const hybrid = rankChunksForQuery({
      query,
      chunks,
      fileNameMap,
      queryEmbedding: [0.98, 0.02],
    });

    expect(keywordOnly.chunks[0]?.chunkIndex).not.toBe(0);
    expect(hybrid.chunks[0]?.chunkIndex).toBe(0);
    expect(hybrid.mode).toBe("hybrid");
  });

  it("improves ranking for typo query over keyword-only", () => {
    const query = "How do soler panels genrate power";
    const keywordOnly = rankChunksForQuery({ query, chunks, fileNameMap });
    const hybrid = rankChunksForQuery({
      query,
      chunks,
      fileNameMap,
      queryEmbedding: [0.93, 0.1],
    });

    expect(keywordOnly.chunks[0]?.chunkIndex).not.toBe(0);
    expect(hybrid.chunks[0]?.chunkIndex).toBe(0);
  });

  it("keeps keyword ranking behavior for exact keyword query", () => {
    const query = "polarity wires circuit";
    const keywordOnly = rankChunksForQuery({ query, chunks, fileNameMap });
    const hybrid = rankChunksForQuery({
      query,
      chunks,
      fileNameMap,
      queryEmbedding: [0.12, 0.92],
    });

    expect(keywordOnly.chunks[0]?.chunkIndex).toBe(2);
    expect(hybrid.chunks[0]?.chunkIndex).toBe(2);
    expect(hybrid.chunks[0]?.score).toBeGreaterThanOrEqual(keywordOnly.chunks[0]?.score ?? 0);
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { knowledgeChunks } from "../drizzle/schema";
import { getDb } from "../server/db";
import { ENV } from "../server/_core/env";
import { embedTexts } from "../server/_core/embedding";

const CHECKPOINT_FILE = path.resolve("scripts/.embedding-backfill.checkpoint.json");
const BATCH_SIZE = Math.max(1, Number(process.env.BACKFILL_BATCH_SIZE ?? 50));
const EMBED_BATCH_SIZE = Math.max(1, Number(process.env.BACKFILL_EMBED_BATCH_SIZE ?? ENV.embeddingBatchSize));

async function readCheckpoint(): Promise<number> {
  try {
    const raw = await fs.readFile(CHECKPOINT_FILE, "utf8");
    const parsed = JSON.parse(raw) as { lastId?: number };
    return parsed.lastId ?? 0;
  } catch {
    return 0;
  }
}

async function writeCheckpoint(lastId: number) {
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify({ lastId }, null, 2));
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let lastId = await readCheckpoint();
  console.log(`[backfill] start from id > ${lastId}`);

  while (true) {
    const rows = await db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          gt(knowledgeChunks.id, lastId),
          isNull(knowledgeChunks.embedding),
          eq(knowledgeChunks.embeddingStatus, "pending")
        )
      )
      .orderBy(asc(knowledgeChunks.id))
      .limit(BATCH_SIZE);

    if (rows.length === 0) {
      console.log("[backfill] completed");
      break;
    }

    for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
      const batch = rows.slice(i, i + EMBED_BATCH_SIZE);
      try {
        const embeddings = await embedTexts(batch.map(item => item.content));

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];
          await db
            .update(knowledgeChunks)
            .set({
              embeddingModel: ENV.embeddingModel,
              embedding,
              embeddingDim: embedding.length,
              embeddingStatus: "completed",
              embeddingError: null,
            })
            .where(eq(knowledgeChunks.id, chunk.id));
          lastId = Math.max(lastId, chunk.id);
          await writeCheckpoint(lastId);
        }
      } catch (error) {
        console.warn("[backfill] embedding batch failed, fallback per chunk", error);
        for (const chunk of batch) {
          try {
            const [embedding] = await embedTexts([chunk.content]);
            await db
              .update(knowledgeChunks)
              .set({
                embeddingModel: ENV.embeddingModel,
                embedding,
                embeddingDim: embedding.length,
                embeddingStatus: "completed",
                embeddingError: null,
              })
              .where(eq(knowledgeChunks.id, chunk.id));
          } catch (itemError) {
            await db
              .update(knowledgeChunks)
              .set({
                embeddingStatus: "failed",
                embeddingError:
                  itemError instanceof Error ? itemError.message : "Embedding failed",
              })
              .where(eq(knowledgeChunks.id, chunk.id));
          }
          lastId = Math.max(lastId, chunk.id);
          await writeCheckpoint(lastId);
        }
      }
    }

    console.log(`[backfill] processed until id=${lastId}`);
  }
}

main().catch(error => {
  console.error("[backfill] fatal", error);
  process.exit(1);
});

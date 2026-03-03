import { ENV } from "./env";

type EmbeddingApiResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

let nextAllowedAt = 0;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resolveEmbeddingUrl = () =>
  `${ENV.llmBaseUrl.replace(/\/$/, "")}/embeddings`;

const isEmbeddingEnabled = () =>
  ENV.embeddingEnabled && Boolean(ENV.geminiApiKey) && Boolean(ENV.embeddingModel);

async function rateLimit() {
  const now = Date.now();
  const waitMs = Math.max(0, nextAllowedAt - now);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  nextAllowedAt = Date.now() + Math.max(0, ENV.embeddingMinIntervalMs);
}

async function requestEmbeddings(input: string[]): Promise<number[][]> {
  await rateLimit();

  const response = await fetch(resolveEmbeddingUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.geminiApiKey}`,
    },
    body: JSON.stringify({
      model: ENV.embeddingModel,
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Embedding request failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const data = (await response.json()) as EmbeddingApiResponse;
  const embeddings = data.data?.map(item => item.embedding ?? []);

  if (!embeddings || embeddings.length !== input.length) {
    throw new Error("Embedding response shape is invalid");
  }

  return embeddings;
}

async function requestEmbeddingsWithRetry(input: string[]): Promise<number[][]> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= ENV.embeddingMaxRetries) {
    try {
      return await requestEmbeddings(input);
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > ENV.embeddingMaxRetries) {
        break;
      }
      await sleep(150 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Embedding request failed");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!isEmbeddingEnabled()) {
    throw new Error("Embedding is not configured");
  }

  if (texts.length === 0) return [];

  const results: number[][] = [];
  const batchSize = Math.max(1, ENV.embeddingBatchSize);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await requestEmbeddingsWithRetry(batch);
    results.push(...batchEmbeddings);
  }

  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding is empty");
  }
  return embedding;
}

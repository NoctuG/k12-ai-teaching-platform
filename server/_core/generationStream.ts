import * as db from "../db";
import { invokeLLMStream } from "./llm";
import type { GenerationInput } from "../routers";
import { prepareGenerationContext } from "../routers";

export type StreamEvent = "start" | "token" | "done" | "error" | "heartbeat";

export async function runGenerationStream(params: {
  userId: number;
  input: GenerationInput;
  emit: (event: StreamEvent, payload: Record<string, unknown>) => void;
}) {
  const { userId, input, emit } = params;
  const result = await db.createGenerationHistory({
    userId,
    resourceType: input.resourceType,
    folderId: input.folderId,
    title: input.title,
    prompt: input.prompt,
    parameters: input.parameters || {},
    knowledgeFileIds: input.knowledgeFileIds || [],
    content: "",
    status: "generating",
  });

  const historyId = Number((result as any).insertId);
  if (input.tagIds && input.tagIds.length > 0) {
    await db.setGenerationTags(userId, historyId, input.tagIds);
  }

  const { retrievalSnapshot, systemPrompt, userMessage } =
    await prepareGenerationContext(input);

  emit("start", { historyId });

  let content = "";
  let lastSnapshotAt = Date.now();

  await invokeLLMStream(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    },
    {
      onToken: async token => {
        content += token;
        emit("token", { delta: token });
        if (Date.now() - lastSnapshotAt > 1500) {
          lastSnapshotAt = Date.now();
          await db.updateGenerationHistory(historyId, {
            content,
            status: "generating",
            ...(retrievalSnapshot ? { retrievalContext: retrievalSnapshot } : {}),
          });
        }
      },
      onDone: async () => {
        await db.updateGenerationHistory(historyId, {
          content,
          status: "completed",
          ...(retrievalSnapshot ? { retrievalContext: retrievalSnapshot } : {}),
        });

        await db.createGenerationHistoryVersion({
          generationId: historyId,
          versionNo: 1,
          contentSnapshot: content,
          editedBy: userId,
          changeSummary: "初始生成",
        });

        emit("done", { historyId, content });
      },
      onError: async error => {
        await db.updateGenerationHistory(historyId, {
          status: "failed",
          errorMessage: error.message,
          ...(retrievalSnapshot ? { retrievalContext: retrievalSnapshot } : {}),
        });
        emit("error", { message: error.message });
      },
      onHeartbeat: () => {
        emit("heartbeat", { ts: Date.now() });
      },
    }
  );
}

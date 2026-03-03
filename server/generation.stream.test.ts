import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGenerationHistory: vi.fn(),
  setGenerationTags: vi.fn(),
  updateGenerationHistory: vi.fn(),
  createGenerationHistoryVersion: vi.fn(),
  prepareGenerationContext: vi.fn(),
  invokeLLMStream: vi.fn(),
}));

vi.mock("./db", () => ({
  createGenerationHistory: mocks.createGenerationHistory,
  setGenerationTags: mocks.setGenerationTags,
  updateGenerationHistory: mocks.updateGenerationHistory,
  createGenerationHistoryVersion: mocks.createGenerationHistoryVersion,
}));

vi.mock("./routers", () => ({
  prepareGenerationContext: mocks.prepareGenerationContext,
}));

vi.mock("./_core/llm", () => ({
  invokeLLMStream: mocks.invokeLLMStream,
}));

import { runGenerationStream } from "./_core/generationStream";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createGenerationHistory.mockResolvedValue({ insertId: 99 });
  mocks.prepareGenerationContext.mockResolvedValue({
    retrievalSnapshot: '{"from":"test"}',
    systemPrompt: "system",
    userMessage: "user",
  });
});

describe("runGenerationStream", () => {
  it("emits start -> token -> done and writes completed state", async () => {
    mocks.invokeLLMStream.mockImplementation(async (_params: any, handlers: any) => {
      await handlers.onToken?.("A");
      await handlers.onToken?.("B");
      await handlers.onDone?.();
    });

    const events: string[] = [];
    await runGenerationStream({
      userId: 1,
      input: {
        resourceType: "courseware",
        title: "T",
        prompt: "P",
      },
      emit: event => events.push(event),
    });

    expect(events[0]).toBe("start");
    expect(events).toContain("token");
    expect(events.at(-1)).toBe("done");
    expect(mocks.updateGenerationHistory).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "completed", content: "AB" })
    );
    expect(mocks.createGenerationHistoryVersion).toHaveBeenCalledWith(
      expect.objectContaining({ generationId: 99, contentSnapshot: "AB" })
    );
  });

  it("converges errors into failed state", async () => {
    mocks.invokeLLMStream.mockImplementation(async (_params: any, handlers: any) => {
      await handlers.onError?.(new Error("boom"));
    });

    const events: string[] = [];
    await runGenerationStream({
      userId: 1,
      input: {
        resourceType: "courseware",
        title: "T",
        prompt: "P",
      },
      emit: event => events.push(event),
    });

    expect(events).toEqual(["start", "error"]);
    expect(mocks.updateGenerationHistory).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "failed", errorMessage: "boom" })
    );
  });
});

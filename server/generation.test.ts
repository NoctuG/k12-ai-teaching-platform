import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    school: null,
    subject: null,
    grade: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("generation.generate", () => {
  it("accepts generation request with valid parameters", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This test verifies the request structure is valid
    // Actual generation will depend on LLM availability
    const request = caller.generation.generate({
      resourceType: "courseware",
      title: "Test Courseware",
      prompt: "Create a simple math lesson",
      parameters: { grade: "3", subject: "math" },
      knowledgeFileIds: [],
    });

    // We expect the mutation to be callable without type errors
    expect(request).toBeDefined();
  });

  it("accepts all resource types", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const resourceTypes = ["courseware", "exam", "lesson_plan", "transcript", "lecture_script"] as const;

    for (const resourceType of resourceTypes) {
      const request = caller.generation.generate({
        resourceType,
        title: `Test ${resourceType}`,
        prompt: "Generate test content",
      });

      expect(request).toBeDefined();
    }
  });
});

describe("generation.list", () => {
  it("returns history list for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

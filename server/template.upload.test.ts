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
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("templates.upload", () => {
  it("should upload a template successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.templates.upload({
      resourceType: "homework",
      title: "小学数学三年级作业设计",
      description: "适用于小学三年级数学课后作业",
      content: "# 作业内容\n\n## 基础题\n1. 计算题...\n\n## 提高题\n2. 应用题...",
      subject: "数学",
      grade: "三年级",
      tags: ["作业", "数学", "三年级"],
    });

    expect(result).toEqual({ success: true });
  });

  it("should support all new resource types", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const resourceTypes = [
      "courseware",
      "exam",
      "lesson_plan",
      "lesson_plan_unit",
      "transcript",
      "lecture_script",
      "homework",
      "question_design",
    ];

    for (const resourceType of resourceTypes) {
      const result = await caller.templates.upload({
        resourceType: resourceType as any,
        title: `测试${resourceType}模板`,
        content: "测试内容",
      });

      expect(result).toEqual({ success: true });
    }
  });
});

describe("templates.myTemplates", () => {
  it("should return user's uploaded templates", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const templates = await caller.templates.myTemplates();

    expect(Array.isArray(templates)).toBe(true);
  });
});

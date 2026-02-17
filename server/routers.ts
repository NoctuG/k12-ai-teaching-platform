import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  user: router({
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        school: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        bio: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUser({
          openId: ctx.user.openId,
          ...input,
        });
        return { success: true };
      }),
  }),

  knowledge: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getKnowledgeFilesByUserId(ctx.user.id);
    }),

    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileContent: z.string(), // Base64 encoded
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileContent, 'base64');
        const fileKey = `knowledge/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        await db.createKnowledgeFile({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize: buffer.length,
          mimeType: input.mimeType,
        });

        return { success: true, url };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteKnowledgeFile(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  generation: router({
    generate: protectedProcedure
      .input(z.object({
        resourceType: z.enum(["courseware", "exam", "lesson_plan", "lesson_plan_unit", "transcript", "lecture_script", "homework", "question_design"]),
        title: z.string(),
        prompt: z.string(),
        parameters: z.record(z.string(), z.any()).optional(),
        knowledgeFileIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Create initial record
        const result = await db.createGenerationHistory({
          userId: ctx.user.id,
          resourceType: input.resourceType,
          title: input.title,
          prompt: input.prompt,
          parameters: input.parameters || {},
          knowledgeFileIds: input.knowledgeFileIds || [],
          content: "",
          status: "generating",
        });

        const historyId = Number((result as any).insertId);

        try {
          // Build context from knowledge files
          let knowledgeContext = "";
          if (input.knowledgeFileIds && input.knowledgeFileIds.length > 0) {
            const files = await Promise.all(
              input.knowledgeFileIds.map(id => db.getKnowledgeFileById(id))
            );
            knowledgeContext = files
              .filter(f => f)
              .map(f => `参考资料: ${f!.fileName}`)
              .join("\n");
          }

          // Generate content using LLM
          const systemPrompt = getSystemPromptForResourceType(input.resourceType);
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${knowledgeContext}\n\n${input.prompt}` },
            ],
          });

          const messageContent = response.choices[0]?.message?.content;
          const content = typeof messageContent === 'string' ? messageContent : "";

          // Update with generated content
          await db.updateGenerationHistory(historyId, {
            content,
            status: "completed",
          });

          return { success: true, historyId, content };
        } catch (error) {
          await db.updateGenerationHistory(historyId, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "生成失败",
          });
          throw error;
        }
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getGenerationHistoryByUserId(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getGenerationHistoryById(input.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateGenerationHistory(input.id, {
          title: input.title,
          content: input.content,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteGenerationHistory(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  templates: router({
    list: publicProcedure.query(async () => {
      return await db.getPublicTemplates();
    }),

    myTemplates: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserTemplates(ctx.user.id);
    }),

    upload: protectedProcedure
      .input(z.object({
        resourceType: z.enum(["courseware", "exam", "lesson_plan", "lesson_plan_unit", "transcript", "lecture_script", "homework", "question_design"]),
        title: z.string(),
        description: z.string().optional(),
        content: z.string(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createTemplate({
          resourceType: input.resourceType,
          title: input.title,
          description: input.description,
          content: input.content,
          subject: input.subject,
          grade: input.grade,
          tags: input.tags,
          isPublic: 0,
          createdBy: ctx.user.id,
          isUserUploaded: 1,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTemplate(input.id, ctx.user.id);
        return { success: true };
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getTemplateById(input.id);
      }),

    incrementUsage: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.incrementTemplateUsage(input.id);
        return { success: true };
      }),
  }),
});

function getSystemPromptForResourceType(resourceType: string): string {
  const prompts = {
    courseware: `你是一位经验丰富的K12教师，擅长制作高质量的教学课件。请根据用户的要求生成完整的课件内容，包括：
1. 课程标题和目标
2. 教学重点和难点
3. 详细的教学内容（分章节）
4. 课堂活动和互动环节
5. 总结和作业布置

要求：
- 内容应符合K12教育标准
- 语言简洁明了，适合学生理解
- 包含具体的教学案例和示例
- 遵循教育演示文稿最佳实践：信息密度低、层次清晰、视觉呈现整洁`,

    exam: `你是一位专业的K12教师，擅长设计科学合理的考试试卷。请根据用户的要求生成完整的试卷，包括：
1. 试卷标题和说明
2. 各类题型（选择题、填空题、简答题、应用题等）
3. 每道题的分值
4. 参考答案和评分标准

要求：
- 题目难度适中，符合指定年级水平
- 知识点覆盖全面
- 题目表述清晰准确
- 答案详细且有解题思路`,

    lesson_plan: `你是一位资深的K12教育专家，擅长编写详细的教学设计。请根据用户的要求生成完整的教学设计，包括：
1. 教学目标（知识目标、能力目标、情感目标）
2. 教学重点和难点
3. 教学方法和手段
4. 教学过程（导入、新课、练习、总结）
5. 板书设计
6. 教学反思

要求：
- 教学设计科学合理
- 教学环节完整流畅
- 注重学生主体地位
- 体现教学创新`,

    transcript: `你是一位经验丰富的K12教师，擅长撰写详细的课堂教学逐字稿。请根据用户的要求生成完整的教学逐字稿，包括：
1. 课程导入语
2. 详细的教学讲解内容
3. 与学生的互动对话
4. 过渡语和总结语
5. 课堂活动的具体指导语

要求：
- 语言自然流畅，口语化
- 内容详细具体，可直接使用
- 包含教师的提问和预期的学生回答
- 体现教学节奏和课堂氛围`,

    lecture_script: `你是一位资深的K12教育专家，擅长撰写专业的说课稿。请根据用户的要求生成完整的说课稿，包括：
1. 教材分析（地位、作用、内容）
2. 学情分析（学生特点、知识基础）
3. 教学目标
4. 教学重点和难点
5. 教学方法和学法指导
6. 教学过程设计
7. 板书设计
8. 教学特色和创新点

要求：
- 理论依据充分
- 分析深入透彻
- 逻辑清晰严谨
- 体现教学理念`,

    lesson_plan_unit: `你是一位资深的K12教育专家，擅长编写大单元教学设计。请根据用户的要求生成完整的大单元教学设计，包括：
1. 单元主题和核心素养目标
2. 单元教学内容分析
3. 学情分析
4. 单元教学目标（知识、能力、素养）
5. 单元教学重点和难点
6. 单元教学课时安排（分课时设计）
7. 单元评价方案
8. 单元教学资源

要求：
- 体现大单元整体设计理念
- 注重核心素养培养
- 课时安排合理
- 评价方式多元化`,

    homework: `你是一位经验丰富的K12教师，擅长设计有效的作业。请根据用户的要求生成完整的作业设计，包括：
1. 作业目标
2. 作业内容（基础题、提高题、拓展题）
3. 作业要求和完成时间
4. 参考答案和评分标准
5. 作业反馈建议

要求：
- 难度梯度合理
- 题量适中
- 注重能力培养
- 体现分层教学`,

    question_design: `你是一位专业的K12教师，擅长设计高质量的试题。请根据用户的要求生成完整的试题设计，包括：
1. 试题题干
2. 选项设计（如适用）
3. 参考答案
4. 解题思路和知识点分析
5. 难度等级和考查目标
6. 命题说明

要求：
- 题目表述清晰准确
- 选项设计科学
- 答案详细规范
- 符合课程标准`,
  };

  return prompts[resourceType as keyof typeof prompts] || prompts.courseware;
}

export type AppRouter = typeof appRouter;

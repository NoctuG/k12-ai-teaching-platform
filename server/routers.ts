import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { buildExportFile, cleanupExportTempDir } from "./exportService";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { transcribeAudio } from "./_core/voiceTranscription";
import { extractTextFromBuffer } from "./_core/textExtraction";
import { splitTextIntoChunks } from "./_core/chunking";
import { retrieveRelevantChunks, formatRetrievalContext } from "./_core/ragRetrieval";

const allResourceTypes = [
  "courseware", "exam", "lesson_plan", "lesson_plan_unit", "transcript", "lecture_script", "homework", "question_design",
  "grading_rubric", "learning_report", "interactive_game", "discussion_chain", "mind_map",
  "parent_letter", "parent_meeting_speech", "pbl_project", "school_curriculum", "competition_questions",
  "pacing_guide", "differentiated_reading",
] as const;

const resourceTypeZod = z.enum(allResourceTypes);

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

        const result = await db.createKnowledgeFile({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize: buffer.length,
          mimeType: input.mimeType,
          processingStatus: "processing",
        });

        const fileId = Number((result as any).insertId);

        // Async text extraction and chunking (non-blocking)
        (async () => {
          try {
            const textContent = await extractTextFromBuffer(buffer, input.mimeType, input.fileName);

            if (!textContent || textContent.trim().length === 0) {
              await db.updateKnowledgeFile(fileId, {
                processingStatus: "completed",
                chunkCount: 0,
                textContent: "",
              });
              return;
            }

            const chunks = splitTextIntoChunks(textContent);

            if (chunks.length > 0) {
              await db.createKnowledgeChunks(
                chunks.map(chunk => ({
                  knowledgeFileId: fileId,
                  userId: ctx.user.id,
                  chunkIndex: chunk.index,
                  content: chunk.content,
                  charCount: chunk.charCount,
                }))
              );
            }

            await db.updateKnowledgeFile(fileId, {
              textContent,
              chunkCount: chunks.length,
              processingStatus: "completed",
            });
          } catch (error) {
            console.error("[RAG] Text extraction failed for file:", input.fileName, error);
            await db.updateKnowledgeFile(fileId, {
              processingStatus: "failed",
              processingError: error instanceof Error ? error.message : "文本提取失败",
            });
          }
        })();

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
        resourceType: resourceTypeZod,
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
          // Build context from knowledge files using RAG retrieval
          let knowledgeContext = "";
          let retrievalSnapshot = "";
          if (input.knowledgeFileIds && input.knowledgeFileIds.length > 0) {
            const files = await db.getKnowledgeFilesByIds(input.knowledgeFileIds);
            const fileNameMap: Record<number, string> = {};
            for (const f of files) {
              fileNameMap[f.id] = f.fileName;
            }

            const retrievedChunks = await retrieveRelevantChunks(
              input.knowledgeFileIds,
              input.prompt,
              fileNameMap
            );

            if (retrievedChunks.length > 0) {
              knowledgeContext = formatRetrievalContext(retrievedChunks);
              // Save retrieval snapshot for traceability
              retrievalSnapshot = JSON.stringify(
                retrievedChunks.map(c => ({
                  file: c.fileName,
                  chunk: c.chunkIndex,
                  score: Math.round(c.score * 1000) / 1000,
                  preview: c.content.slice(0, 100),
                }))
              );
            } else {
              // Fallback: if no chunks exist yet (files still processing), use filenames
              knowledgeContext = files
                .map(f => `参考资料: ${f.fileName}`)
                .join("\n");
            }
          }

          // Build the system prompt, with optional curriculum alignment
          let systemPrompt = getSystemPromptForResourceType(input.resourceType);
          if (input.parameters?.alignCurriculumStandards) {
            systemPrompt += `\n\n【课标对齐模式】请在教学目标和教学环节的对应位置，以标签形式标注当前环节培养的"核心素养"（如：[科学思维]、[文化自信]、[语言运用]、[审美创造]、[实践创新]等），确保每个教学环节都能体现课标要求。`;
          }

          // Generate content using LLM with RAG context
          const userMessage = knowledgeContext
            ? `${knowledgeContext}\n\n---\n\n${input.prompt}`
            : input.prompt;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          });

          const messageContent = response.choices[0]?.message?.content;
          const content = typeof messageContent === 'string' ? messageContent : "";

          // Update with generated content and retrieval snapshot
          await db.updateGenerationHistory(historyId, {
            content,
            status: "completed",
            ...(retrievalSnapshot ? { retrievalContext: retrievalSnapshot } : {}),
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

    search: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        resourceType: z.string().optional(),
        favoritesOnly: z.boolean().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.searchGenerationHistory(ctx.user.id, input);
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

    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const newValue = await db.toggleFavorite(input.id, ctx.user.id);
        return { success: true, isFavorite: newValue === 1 };
      }),

    toggleShare: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { nanoid } = require("nanoid");
        const token = nanoid(16);
        const isShared = await db.toggleShare(input.id, ctx.user.id, token);
        return { success: true, isShared };
      }),

    shared: publicProcedure.query(async () => {
      return await db.getSharedResources();
    }),

    getSharedByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        return await db.getSharedResourceByToken(input.token);
      }),

    export: protectedProcedure
      .input(z.object({
        generationHistoryId: z.number().optional(),
        markdown: z.string().optional(),
        title: z.string().optional(),
        resourceType: resourceTypeZod.optional(),
        format: z.enum(["pptx", "docx", "pdf"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const history = input.generationHistoryId ? await db.getGenerationHistoryById(input.generationHistoryId) : undefined;
        if (input.generationHistoryId && !history) {
          throw new Error("记录不存在");
        }

        const title = input.title || history?.title || "未命名导出";
        const markdown = input.markdown || history?.content;
        const resourceType = input.resourceType || history?.resourceType;
        if (!markdown) {
          throw new Error("缺少导出内容");
        }

        const createResult = await db.createGenerationExportTask({
          userId: ctx.user.id,
          generationHistoryId: input.generationHistoryId,
          resourceType,
          exportType: input.format,
          status: "processing",
          sourceTitle: title,
          sourceMarkdown: markdown,
        });
        const exportId = Number((createResult as any).insertId);

        let cleanupDir = "";
        try {
          const artifact = await buildExportFile({ title, markdown, format: input.format, resourceType });
          cleanupDir = artifact.cleanupDir;
          const filename = `${title}.${artifact.extension}`;

          let fileUrl: string | null = null;
          try {
            const upload = await storagePut(`exports/${ctx.user.id}/${exportId}-${filename}`, artifact.buffer, {
              pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              pdf: "application/pdf",
            }[input.format]);
            fileUrl = upload.url;
            await db.updateGenerationExportTask(exportId, {
              status: "completed",
              fileName: filename,
              fileKey: upload.key,
              fileUrl: upload.url,
            });
          } catch {
            await db.updateGenerationExportTask(exportId, {
              status: "completed",
              fileName: filename,
            });
          }

          return {
            success: true,
            exportId,
            filename,
            content: artifact.buffer.toString("base64"),
            fileUrl,
          };
        } catch (error) {
          await db.updateGenerationExportTask(exportId, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "导出失败",
          });
          throw error;
        } finally {
          if (cleanupDir) {
            await cleanupExportTempDir(cleanupDir);
          }
        }
      }),

    listExports: protectedProcedure
      .input(z.object({ generationHistoryId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getGenerationExportTasksByHistoryId(input.generationHistoryId, ctx.user.id);
      }),
  }),

  comments: router({
    createClass: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        stage: z.string().min(1),
        grade: z.string().min(1),
        term: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createClass({ userId: ctx.user.id, ...input });
        return { success: true, classId: Number((result as any).insertId) };
      }),

    listClasses: protectedProcedure.query(async ({ ctx }) => {
      return await db.getClassesByUserId(ctx.user.id);
    }),

    listStudentsByClass: protectedProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getStudentsByClassId(ctx.user.id, input.classId);
      }),

    upsertStudents: protectedProcedure
      .input(z.object({
        classId: z.number(),
        students: z.array(z.object({
          name: z.string().min(1),
          studentNo: z.string().optional(),
          status: z.enum(["active", "inactive", "graduated"]).default("active"),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createStudents(input.students.map((student) => ({
          userId: ctx.user.id,
          classId: input.classId,
          name: student.name,
          studentNo: student.studentNo,
          status: student.status,
        })));
        return { success: true };
      }),

    // 创建批量评语任务
    createBatch: protectedProcedure
      .input(z.object({
        classId: z.number(),
        term: z.string().min(1),
        batchTitle: z.string(),
        commentType: z.enum(["final_term", "homework", "daily", "custom"]),
        students: z.array(z.object({
          studentId: z.number(),
          name: z.string(),
          performance: z.string(), // 学生表现描述
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        // 创建初始记录
        const result = await db.createStudentCommentBatch({
          userId: ctx.user.id,
          batchTitle: input.batchTitle,
          commentType: input.commentType,
          students: input.students.map(s => ({ ...s, comment: "" })),
          totalCount: input.students.length,
          status: "generating",
        });

        const batchId = Number((result as any).insertId);

        // 异步生成评语
        (async () => {
          try {
            const studentsWithComments = await Promise.all(
              input.students.map(async (student) => {
                const systemPrompt = getCommentSystemPrompt(input.commentType);
                const response = await invokeLLM({
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `学生姓名：${student.name}\n表现描述：${student.performance}` },
                  ],
                });

                const messageContent = response.choices[0]?.message?.content;
                const comment = typeof messageContent === 'string' ? messageContent : "生成失败";

                return {
                  name: student.name,
                  performance: student.performance,
                  comment,
                };
              })
            );

            await db.updateStudentComment(batchId, {
              students: studentsWithComments,
              status: "completed",
            });

            await db.createStudentCommentGenerations(studentsWithComments.map((student, index) => ({
              userId: ctx.user.id,
              classId: input.classId,
              studentId: input.students[index].studentId,
              term: input.term,
              batchTitle: input.batchTitle,
              commentType: input.commentType,
              performance: student.performance,
              comment: student.comment,
              status: "completed",
            })));
          } catch (error) {
            await db.updateStudentComment(batchId, {
              status: "failed",
            });
          }
        })();

        return { success: true, batchId };
      }),

    // 获取评语列表
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getStudentCommentsByUserId(ctx.user.id);
    }),

    history: protectedProcedure
      .input(z.object({ classId: z.number(), term: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getStructuredCommentHistory(ctx.user.id, input.classId, input.term);
      }),

    trend: protectedProcedure
      .input(z.object({ classId: z.number(), studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getPerformanceTrend(ctx.user.id, input.classId, input.studentId);
      }),

    // 获取单个评语批次
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getStudentCommentById(input.id);
      }),

    // 删除评语批次
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteStudentComment(input.id, ctx.user.id);
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
        resourceType: resourceTypeZod,
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

  // 多模态功能：AI图片生成
  imageGen: router({
    generate: protectedProcedure
      .input(z.object({
        prompt: z.string(),
        originalImageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await generateImage({
          prompt: input.prompt,
          originalImages: input.originalImageUrl
            ? [{ url: input.originalImageUrl }]
            : undefined,
        });
        return { success: true, url: result.url };
      }),
  }),

  // 多模态功能：语音转文字
  voice: router({
    transcribe: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
        prompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio(input);

        if ('error' in result) {
          throw new Error(result.error);
        }

        return result;
      }),
  }),
});

function getCommentSystemPrompt(commentType: string): string {
  const prompts = {
    final_term: `你是一位经验丰富的K12教师，擅长撰写学生期末评语。请根据学生的表现描述生成个性化的期末评语。

要求：
1. 语言亲切、积极、鼓励性
2. 内容具体、有针对性
3. 长度100-150字
4. 包含优点、进步和期望
5. 符合教育规范，体现全面发展`,

    homework: `你是一位经验丰富的K12教师，擅长撰写作业评价。请根据学生的作业表现生成个性化的作业评语。

要求：
1. 语言简洁、具体
2. 指出优点和需要改进之处
3. 长度50-80字
4. 给出建议和鼓励
5. 体现教师关怀`,

    daily: `你是一位经验丰富的K12教师，擅长撰写日常表现评价。请根据学生的日常表现生成简短的评价。

要求：
1. 语言简洁、直接
2. 长度30-50字
3. 积极正面，鼓励为主
4. 具体指出表现`,

    custom: `你是一位经验丰富的K12教师，擅长撰写学生评语。请根据学生的表现描述生成个性化的评语。

要求：
1. 语言亲切、具体
2. 内容有针对性
3. 长度80-120字
4. 体现教育关怀`,
  };

  return prompts[commentType as keyof typeof prompts] || prompts.custom;
}

function getSystemPromptForResourceType(resourceType: string): string {
  const prompts: Record<string, string> = {
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

    // ===== 教学评估类 =====
    grading_rubric: `你是一位资深的K12教育评价专家，擅长制定科学的评分标准和批改辅助方案。请根据用户的要求生成完整的评分标准/批改辅助方案，包括：
1. 评价维度（知识掌握、能力表现、情感态度等）
2. 每个维度的具体评分等级（优秀/良好/合格/待提高）
3. 每个等级的详细描述和判定标准
4. 常见典型错误分析及扣分建议
5. 批改符号说明和使用规范
6. 综合评价模板和反馈建议

要求：
- 评价标准客观、可操作
- 体现形成性评价理念
- 兼顾知识与能力的多元评价
- 提供具体的批注示例和反馈话术`,

    learning_report: `你是一位专业的K12教育数据分析师，擅长根据学生学习数据生成学情分析报告。请根据用户提供的信息生成完整的学情分析报告，包括：
1. 班级/学生基本情况概述
2. 各知识模块掌握情况分析（用表格或列表呈现）
3. 学习薄弱点识别与诊断
4. 学生分层画像（学优生/中等生/待提高生特征）
5. 教学建议（针对性补救策略）
6. 下阶段教学重点建议
7. 家校沟通建议

要求：
- 数据分析逻辑清晰
- 诊断结论有据可依
- 建议具体可落地
- 语言专业但易于理解`,

    // ===== 课堂互动类 =====
    interactive_game: `你是一位富有创意的K12教育游戏设计师，擅长设计寓教于乐的课堂互动游戏。请根据用户的要求生成完整的互动游戏设计方案，包括：
1. 游戏名称和主题
2. 游戏目标（知识目标和能力目标）
3. 适用年级和学科
4. 游戏规则详细说明
5. 所需材料和准备工作
6. 游戏流程（热身→主体→总结）
7. 计分/奖励机制
8. 变体玩法（适应不同课堂场景）
9. 注意事项和安全提醒

要求：
- 游戏设计有趣、易于操作
- 寓教于乐，知识点覆盖明确
- 全员参与，避免旁观者效应
- 时间控制在5-15分钟
- 可适应线上/线下不同场景`,

    discussion_chain: `你是一位擅长苏格拉底式教学的K12教育专家，精于设计层层递进的讨论话题和问题链。请根据用户的要求生成完整的讨论话题/问题链设计，包括：
1. 主题概述和讨论目标
2. 热身问题（唤起已有经验，1-2个）
3. 核心问题链（由浅入深，4-6个递进问题）
4. 每个问题的设计意图和预期学生回答
5. 追问策略（当学生回答偏浅时的引导问题）
6. 辩论/分组讨论环节设计
7. 总结提升问题（回归高阶思维）
8. 讨论评价标准

要求：
- 问题链逻辑递进，从记忆→理解→应用→分析→评价→创造
- 开放性与封闭性问题结合
- 预设学生可能的回答和误区
- 体现批判性思维和合作学习
- 引导学生深度思考`,

    mind_map: `你是一位善于结构化思维的K12教育专家，擅长将知识体系转化为清晰的思维导图。请根据用户的要求生成完整的思维导图内容，包括：
1. 中心主题
2. 一级分支（核心概念/大模块，3-6个）
3. 二级分支（每个一级分支下的子概念，2-4个）
4. 三级分支（关键细节、案例、公式等）
5. 各节点之间的关联说明
6. 重点标注和颜色建议
7. 记忆口诀或助记方法

请用层级缩进的Markdown格式输出，方便转化为思维导图工具可读取的格式。

要求：
- 结构清晰，层次分明
- 关键词精炼（每个节点不超过8个字）
- 覆盖核心知识点
- 体现知识间的逻辑关系
- 适合学生复习和记忆使用`,

    // ===== 家校沟通类 =====
    parent_letter: `你是一位善于家校沟通的K12班主任，擅长撰写温暖专业的家长通知和家长信。请根据用户的要求生成完整的家长通知/家长信，包括：
1. 称呼和问候语
2. 通知/告知的具体事项
3. 需要家长配合的事项（如有）
4. 时间、地点等关键信息（如涉及）
5. 温馨提示和注意事项
6. 联系方式和反馈渠道
7. 落款（教师/学校）

要求：
- 语气温和、尊重、专业
- 信息表达清晰明确
- 体现家校合作理念
- 避免命令式口吻
- 格式规范整洁`,

    parent_meeting_speech: `你是一位擅长家校沟通的K12班主任，精于撰写家长会发言稿。请根据用户的要求生成完整的家长会发言稿，包括：
1. 开场白（感谢家长到来）
2. 班级整体情况汇报
3. 本学期教育教学重点
4. 学生近期表现分析（整体+分类）
5. 家庭教育建议
6. 安全/心理健康提醒
7. 下阶段工作安排
8. 互动答疑环节引导语
9. 总结致谢

要求：
- 时长控制在20-30分钟发言量
- 语言亲切、有温度
- 数据说话，客观呈现
- 关注家长感受，避免过度批评
- 提供可操作的家教建议`,

    // ===== 跨学科/特殊场景 =====
    pbl_project: `你是一位精通项目式学习(PBL)的K12教育专家。请根据用户的要求生成完整的PBL项目方案，包括：
1. 项目名称和驱动性问题
2. 项目概述（背景、意义、预期成果）
3. 学科融合点和核心素养目标
4. 项目阶段规划
   - 启动阶段（情境创设、问题提出）
   - 探究阶段（任务分解、资料收集、实践探索）
   - 制作阶段（成果创作、迭代优化）
   - 展示阶段（成果展示、反思评价）
5. 每阶段的具体任务单和支架工具
6. 评价量规（过程性评价+终结性评价）
7. 所需资源和材料清单
8. 教师指导要点和注意事项

要求：
- 驱动性问题真实、有挑战性
- 跨学科融合自然
- 学生主体，教师引导
- 成果可展示、可评价
- 体现21世纪核心技能培养`,

    school_curriculum: `你是一位精通校本课程开发的K12教育专家。请根据用户的要求生成完整的校本课程开发方案，包括：
1. 课程名称和定位
2. 课程背景和开发依据
3. 课程目标（总目标和分级目标）
4. 课程内容框架（模块划分和主题设计）
5. 课程实施建议
   - 教学方法和策略
   - 课时安排
   - 教学资源
6. 课程评价方案
   - 学生学习评价
   - 课程实施评价
7. 课程保障条件
8. 各模块的详细教学设计纲要

要求：
- 立足学校特色和地方文化
- 符合课程开发规范
- 内容系统完整
- 可操作性强
- 体现素质教育理念`,

    competition_questions: `你是一位资深的K12学科竞赛培训专家，擅长设计高水平的竞赛训练题目。请根据用户的要求生成完整的竞赛培训题库，包括：
1. 知识专题分类
2. 每个专题下的阶梯式训练题（入门→进阶→挑战）
3. 每道题的详细解题过程
4. 一题多解展示（经典题目）
5. 易错点和陷阱分析
6. 竞赛真题改编
7. 思维方法总结

要求：
- 难度高于课标，但循序渐进
- 注重思维训练和方法归纳
- 解题过程详尽规范
- 覆盖常考知识专题
- 适合学生自主训练使用`,

    // ===== 教学深度 =====
    pacing_guide: `你是一位经验丰富的K12教学管理专家，擅长制定科学合理的学期教学进度计划。请根据用户提供的学科、年级和学期信息，生成完整的学期教学进度表(Pacing Guide)，包括：
1. 学期总体教学规划
   - 总课时数和教学周数
   - 核心教学目标
2. 月度教学安排（按月份或教学周拆分）
   - 每周教学内容和课题
   - 对应课标要求
   - 重点和难点
3. 考试/测评节点安排
   - 单元测试时间
   - 期中/期末考试安排
4. 弹性调整空间说明
5. 假期和校历事件标注
6. 教学资源准备清单

请以表格形式输出教学进度安排，方便教师直接使用。

要求：
- 进度安排科学合理
- 充分考虑学生学习节奏
- 预留复习和机动课时
- 与课标紧密对齐
- 标注重要教学节点`,

    differentiated_reading: `你是一位精通分层教学的K12语文/英语教育专家，擅长将阅读材料改写为不同难度等级的版本。请根据用户提供的原文，生成三个难度层次的改写版本：

**Level A（基础版）**
- 适合基础较薄弱的学生
- 降低生词量（使用常用词替换难词）
- 缩短句子长度，减少复合句
- 增加解释性语句和过渡词
- 可适当简化段落结构

**Level B（标准版）**
- 适合中等水平学生
- 保持核心内容和主要表达
- 适度调整句式复杂度
- 保留关键术语但加入简要注释

**Level C（提升版）**
- 适合学有余力的学生
- 拓展原文深度（增加背景知识、延伸思考）
- 使用更丰富的词汇和句式
- 增加开放性思考问题
- 提供跨学科关联内容

每个版本需附带：
1. 预估适合的阅读水平
2. 生词表和注释
3. 3-5道配套阅读理解题

要求：
- 三个版本核心信息一致
- 难度梯度清晰
- 改写自然流畅，不生硬
- 保持原文的教育价值`,
  };

  return prompts[resourceType] || prompts.courseware;
}

export type AppRouter = typeof appRouter;

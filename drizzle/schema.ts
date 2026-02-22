import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with teacher profile information.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Teacher profile fields
  school: text("school"), // 学校
  subject: text("subject"), // 任教学科
  grade: text("grade"), // 任教年级
  bio: text("bio"), // 个人简介
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Knowledge base files uploaded by teachers
 */
export const knowledgeFiles = mysqlTable("knowledge_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users
  folderId: int("folderId"), // Optional folder, null = root
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileUrl: text("fileUrl").notNull(), // S3 URL
  fileSize: int("fileSize").notNull(), // File size in bytes
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  description: text("description"), // Optional description
  textContent: text("textContent"), // Full extracted text content
  chunkCount: int("chunkCount").default(0).notNull(), // Number of chunks created
  processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  processingError: text("processingError"), // Error message if processing failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type InsertKnowledgeFile = typeof knowledgeFiles.$inferInsert;

/**
 * Knowledge file chunks for RAG retrieval
 */
export const knowledgeChunks = mysqlTable("knowledge_chunks", {
  id: int("id").autoincrement().primaryKey(),
  knowledgeFileId: int("knowledgeFileId").notNull(), // Foreign key to knowledge_files
  userId: int("userId").notNull(), // Denormalized for query efficiency
  chunkIndex: int("chunkIndex").notNull(), // Order within the file
  content: text("content").notNull(), // Chunk text content
  charCount: int("charCount").notNull(), // Character count for the chunk
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

/**
 * Resource types that can be generated
 */
export const resourceTypeEnum = mysqlEnum("resourceType", [
  "courseware", // 课件
  "exam", // 试卷
  "lesson_plan", // 教学设计
  "lesson_plan_unit", // 大单元教学设计
  "transcript", // 逐字稿
  "lecture_script", // 说课稿
  "homework", // 作业设计
  "question_design", // 试题设计
  // 教学评估类
  "grading_rubric", // 批改辅助/评分标准生成
  "learning_report", // 学情分析报告
  // 课堂互动类
  "interactive_game", // 互动游戏设计
  "discussion_chain", // 讨论话题/问题链设计
  "mind_map", // 思维导图生成
  // 家校沟通类
  "parent_letter", // 家长通知/家长信
  "parent_meeting_speech", // 家长会发言稿
  // 跨学科/特殊场景
  "pbl_project", // 项目式学习(PBL)方案
  "school_curriculum", // 校本课程开发
  "competition_questions", // 竞赛培训题库
  // 教学深度
  "pacing_guide", // 学期教学进度表
  "differentiated_reading", // 分层阅读材料改写
]);

/**
 * Generation history records
 */
export const generationHistory = mysqlTable("generation_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  folderId: int("folderId"), // Optional folder, null = root
  resourceType: resourceTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(), // User input/requirements
  parameters: json("parameters"), // Generation parameters (difficulty, grade, etc.)
  content: text("content").notNull(), // Generated content
  knowledgeFileIds: json("knowledgeFileIds"), // Array of knowledge file IDs used
  retrievalContext: text("retrievalContext"), // Snapshot of RAG-retrieved chunks used in generation
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"), // Error message if failed
  isFavorite: int("isFavorite").default(0).notNull(), // 1 = favorite, 0 = not
  isShared: int("isShared").default(0).notNull(), // 1 = shared, 0 = private
  shareToken: varchar("shareToken", { length: 64 }), // Unique share token for public access
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GenerationHistory = typeof generationHistory.$inferSelect;
export type InsertGenerationHistory = typeof generationHistory.$inferInsert;

/**
 * User-scoped folder tree for organizing knowledge and generated resources.
 */
export const folders = mysqlTable("folders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: int("parentId"), // Supports parent-child hierarchy
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = typeof folders.$inferInsert;

/**
 * Reusable tags and resource-tag mappings for multi-dimensional retrieval.
 */
export const resourceTags = mysqlTable("resource_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResourceTag = typeof resourceTags.$inferSelect;
export type InsertResourceTag = typeof resourceTags.$inferInsert;

export const knowledgeFileTags = mysqlTable("knowledge_file_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  knowledgeFileId: int("knowledgeFileId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const generationHistoryTags = mysqlTable("generation_history_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  generationId: int("generationId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Immutable version snapshots for generated content edits and rollback auditing.
 */
export const generationHistoryVersions = mysqlTable("generation_history_versions", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  versionNo: int("versionNo").notNull(),
  contentSnapshot: text("contentSnapshot").notNull(),
  contentDiff: text("contentDiff"), // Optional unified diff
  editedBy: int("editedBy").notNull(),
  changeSummary: text("changeSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GenerationHistoryVersion = typeof generationHistoryVersions.$inferSelect;
export type InsertGenerationHistoryVersion = typeof generationHistoryVersions.$inferInsert;

export const exportTypeEnum = mysqlEnum("exportType", ["pptx", "docx", "pdf"]);
export const exportStatusEnum = mysqlEnum("exportStatus", ["processing", "completed", "failed"]);

/**
 * Export task records for generated resources.
 */
export const generationExports = mysqlTable("generation_exports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  generationHistoryId: int("generationHistoryId"),
  resourceType: resourceTypeEnum,
  exportType: exportTypeEnum.notNull(),
  status: exportStatusEnum.default("processing").notNull(),
  sourceTitle: varchar("sourceTitle", { length: 255 }).notNull(),
  sourceMarkdown: text("sourceMarkdown").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: text("fileUrl"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GenerationExport = typeof generationExports.$inferSelect;
export type InsertGenerationExport = typeof generationExports.$inferInsert;

/**
 * Resource templates for teachers to reference
 */
export const resourceTemplates = mysqlTable("resource_templates", {
  id: int("id").autoincrement().primaryKey(),
  resourceType: resourceTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  content: text("content").notNull(), // Template content
  subject: text("subject"), // Subject area
  grade: text("grade"), // Grade level
  tags: json("tags"), // Array of tags
  isPublic: int("isPublic").default(1).notNull(), // 1 = public, 0 = private
  createdBy: int("createdBy"), // User ID who created it (null for system templates)
  usageCount: int("usageCount").default(0).notNull(), // How many times used
  isUserUploaded: int("isUserUploaded").default(0).notNull(), // 1 = user uploaded, 0 = system
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResourceTemplate = typeof resourceTemplates.$inferSelect;
export type InsertResourceTemplate = typeof resourceTemplates.$inferInsert;

/**
 * Student comment batch generation records
 */
export const studentComments = mysqlTable("student_comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  batchTitle: varchar("batchTitle", { length: 255 }).notNull(), // 批次标题（例如：2024年春季期末评语）
  commentType: mysqlEnum("commentType", ["final_term", "homework", "daily", "custom"]).notNull(), // 评语类型
  students: json("students").notNull(), // 学生信息数组 [{name, performance, comment}]
  totalCount: int("totalCount").notNull(), // 学生总数
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentComment = typeof studentComments.$inferSelect;
export type InsertStudentComment = typeof studentComments.$inferInsert;

/**
 * Structured class roster owned by teacher(user).
 */
export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  stage: varchar("stage", { length: 64 }).notNull(), // 学段
  grade: varchar("grade", { length: 64 }).notNull(),
  term: varchar("term", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

/**
 * Structured student profile.
 */
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classId: int("classId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  studentNo: varchar("studentNo", { length: 64 }),
  status: mysqlEnum("status", ["active", "inactive", "graduated"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

/**
 * Student learning/performance records for trend analysis.
 */
export const studentPerformanceRecords = mysqlTable("student_performance_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classId: int("classId").notNull(),
  studentId: int("studentId").notNull(),
  recordAt: timestamp("recordAt").defaultNow().notNull(),
  dimension: varchar("dimension", { length: 128 }).notNull(),
  indicator: varchar("indicator", { length: 128 }).notNull(),
  teacherNote: text("teacherNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StudentPerformanceRecord = typeof studentPerformanceRecords.$inferSelect;
export type InsertStudentPerformanceRecord = typeof studentPerformanceRecords.$inferInsert;

/**
 * Structured generated comments (batch + student result rows).
 */
export const studentCommentGenerations = mysqlTable("student_comment_generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classId: int("classId").notNull(),
  studentId: int("studentId").notNull(),
  term: varchar("term", { length: 64 }).notNull(),
  batchTitle: varchar("batchTitle", { length: 255 }).notNull(),
  commentType: mysqlEnum("commentType", ["final_term", "homework", "daily", "custom"]).notNull(),
  performance: text("performance"),
  comment: text("comment").notNull(),
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentCommentGeneration = typeof studentCommentGenerations.$inferSelect;
export type InsertStudentCommentGeneration = typeof studentCommentGenerations.$inferInsert;

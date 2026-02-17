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
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileUrl: text("fileUrl").notNull(), // S3 URL
  fileSize: int("fileSize").notNull(), // File size in bytes
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  description: text("description"), // Optional description
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type InsertKnowledgeFile = typeof knowledgeFiles.$inferInsert;

/**
 * Resource types that can be generated
 */
export const resourceTypeEnum = mysqlEnum("resourceType", [
  "courseware", // 课件
  "exam", // 试卷
  "lesson_plan", // 教学设计
  "transcript", // 逐字稿
  "lecture_script", // 说课稿
]);

/**
 * Generation history records
 */
export const generationHistory = mysqlTable("generation_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  resourceType: resourceTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(), // User input/requirements
  parameters: json("parameters"), // Generation parameters (difficulty, grade, etc.)
  content: text("content").notNull(), // Generated content
  knowledgeFileIds: json("knowledgeFileIds"), // Array of knowledge file IDs used
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"), // Error message if failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GenerationHistory = typeof generationHistory.$inferSelect;
export type InsertGenerationHistory = typeof generationHistory.$inferInsert;

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResourceTemplate = typeof resourceTemplates.$inferSelect;
export type InsertResourceTemplate = typeof resourceTemplates.$inferInsert;

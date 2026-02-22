import { eq, desc, and, like, or, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  knowledgeFiles,
  InsertKnowledgeFile,
  knowledgeChunks,
  InsertKnowledgeChunk,
  generationHistory,
  InsertGenerationHistory,
  generationExports,
  InsertGenerationExport,
  resourceTemplates,
  InsertResourceTemplate,
  studentComments,
  InsertStudentComment
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash", "school", "subject", "grade", "bio"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Knowledge Files
export async function createKnowledgeFile(file: InsertKnowledgeFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(knowledgeFiles).values(file);
  return result;
}

export async function getKnowledgeFilesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.userId, userId)).orderBy(desc(knowledgeFiles.createdAt));
}

export async function deleteKnowledgeFile(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete associated chunks first
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeFileId, id));
  await db.delete(knowledgeFiles).where(and(eq(knowledgeFiles.id, id), eq(knowledgeFiles.userId, userId)));
}

export async function getKnowledgeFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getKnowledgeFilesByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(knowledgeFiles).where(inArray(knowledgeFiles.id, ids));
}

export async function updateKnowledgeFile(id: number, updates: Partial<InsertKnowledgeFile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(knowledgeFiles).set(updates).where(eq(knowledgeFiles.id, id));
}

// Knowledge Chunks
export async function createKnowledgeChunks(chunks: InsertKnowledgeChunk[]) {
  if (chunks.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(knowledgeChunks).values(chunks);
}

export async function deleteKnowledgeChunksByFileId(knowledgeFileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeFileId, knowledgeFileId));
}

// Generation History
export async function createGenerationHistory(history: InsertGenerationHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(generationHistory).values(history);
  return result;
}

export async function getGenerationHistoryByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(generationHistory).where(eq(generationHistory.userId, userId)).orderBy(desc(generationHistory.createdAt));
}

export async function getGenerationHistoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(generationHistory).where(eq(generationHistory.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateGenerationHistory(id: number, updates: Partial<InsertGenerationHistory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(generationHistory).set(updates).where(eq(generationHistory.id, id));
}

export async function deleteGenerationHistory(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(generationHistory).where(and(eq(generationHistory.id, id), eq(generationHistory.userId, userId)));
}

export async function createGenerationExportTask(task: InsertGenerationExport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(generationExports).values(task);
}

export async function updateGenerationExportTask(id: number, updates: Partial<InsertGenerationExport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(generationExports).set(updates).where(eq(generationExports.id, id));
}

export async function getGenerationExportTasksByHistoryId(generationHistoryId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(generationExports)
    .where(and(eq(generationExports.generationHistoryId, generationHistoryId), eq(generationExports.userId, userId)))
    .orderBy(desc(generationExports.createdAt));
}

// Resource Templates
export async function getPublicTemplates() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(resourceTemplates).where(eq(resourceTemplates.isPublic, 1)).orderBy(desc(resourceTemplates.usageCount));
}

export async function getUserTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(resourceTemplates).where(and(eq(resourceTemplates.createdBy, userId), eq(resourceTemplates.isUserUploaded, 1))).orderBy(desc(resourceTemplates.createdAt));
}

export async function createTemplate(template: InsertResourceTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(resourceTemplates).values(template);
  return result;
}

export async function deleteTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(resourceTemplates).where(and(eq(resourceTemplates.id, id), eq(resourceTemplates.createdBy, userId)));
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(resourceTemplates).where(eq(resourceTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementTemplateUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const template = await getTemplateById(id);
  if (template) {
    await db.update(resourceTemplates).set({ usageCount: template.usageCount + 1 }).where(eq(resourceTemplates.id, id));
  }
}

// Student Comments functions
export async function createStudentCommentBatch(data: InsertStudentComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(studentComments).values(data);
  return result;
}

export async function getStudentCommentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(studentComments).where(eq(studentComments.userId, userId)).orderBy(desc(studentComments.createdAt));
}

export async function getStudentCommentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(studentComments).where(eq(studentComments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStudentComment(id: number, data: Partial<InsertStudentComment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(studentComments).set(data).where(eq(studentComments.id, id));
}

export async function deleteStudentComment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(studentComments).where(and(eq(studentComments.id, id), eq(studentComments.userId, userId)));
}

// Search & Filter Generation History
export async function searchGenerationHistory(userId: number, options: {
  search?: string;
  resourceType?: string;
  favoritesOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(generationHistory.userId, userId)];

  if (options.resourceType) {
    conditions.push(sql`${generationHistory.resourceType} = ${options.resourceType}`);
  }

  if (options.favoritesOnly) {
    conditions.push(eq(generationHistory.isFavorite, 1));
  }

  if (options.search) {
    const searchPattern = `%${options.search}%`;
    conditions.push(
      or(
        like(generationHistory.title, searchPattern),
        like(generationHistory.prompt, searchPattern),
      )!
    );
  }

  return await db.select()
    .from(generationHistory)
    .where(and(...conditions))
    .orderBy(desc(generationHistory.createdAt));
}

// Toggle Favorite
export async function toggleFavorite(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const record = await db.select()
    .from(generationHistory)
    .where(and(eq(generationHistory.id, id), eq(generationHistory.userId, userId)))
    .limit(1);

  if (record.length === 0) throw new Error("记录不存在");

  const newValue = record[0].isFavorite === 1 ? 0 : 1;
  await db.update(generationHistory)
    .set({ isFavorite: newValue })
    .where(eq(generationHistory.id, id));

  return newValue;
}

// Share/Unshare
export async function toggleShare(id: number, userId: number, shareToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const record = await db.select()
    .from(generationHistory)
    .where(and(eq(generationHistory.id, id), eq(generationHistory.userId, userId)))
    .limit(1);

  if (record.length === 0) throw new Error("记录不存在");

  const isCurrentlyShared = record[0].isShared === 1;
  await db.update(generationHistory)
    .set({
      isShared: isCurrentlyShared ? 0 : 1,
      shareToken: isCurrentlyShared ? null : shareToken,
    })
    .where(eq(generationHistory.id, id));

  return !isCurrentlyShared;
}

// Get shared resources (public browsing)
export async function getSharedResources() {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
    id: generationHistory.id,
    resourceType: generationHistory.resourceType,
    title: generationHistory.title,
    prompt: generationHistory.prompt,
    content: generationHistory.content,
    createdAt: generationHistory.createdAt,
    shareToken: generationHistory.shareToken,
  })
    .from(generationHistory)
    .where(eq(generationHistory.isShared, 1))
    .orderBy(desc(generationHistory.createdAt));
}

// Get a shared resource by token
export async function getSharedResourceByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(generationHistory)
    .where(and(
      eq(generationHistory.shareToken, token),
      eq(generationHistory.isShared, 1),
    ))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

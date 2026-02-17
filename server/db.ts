import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  knowledgeFiles, 
  InsertKnowledgeFile,
  generationHistory,
  InsertGenerationHistory,
  resourceTemplates,
  InsertResourceTemplate
} from "../drizzle/schema";
import { ENV } from './_core/env';

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

    const textFields = ["name", "email", "loginMethod", "school", "subject", "grade", "bio"] as const;
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
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

  await db.delete(knowledgeFiles).where(and(eq(knowledgeFiles.id, id), eq(knowledgeFiles.userId, userId)));
}

export async function getKnowledgeFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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

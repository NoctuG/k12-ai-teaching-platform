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
  InsertStudentComment,
  classes,
  students,
  studentPerformanceRecords,
  studentCommentGenerations,
  InsertClass,
  InsertStudent,
  InsertStudentCommentGeneration,
  folders,
  InsertFolder,
  resourceTags,
  InsertResourceTag,
  knowledgeFileTags,
  generationHistoryTags,
  generationHistoryVersions,
  InsertGenerationHistoryVersion,
  collaborationSessions,
  resourceComments,
  resourcePresence,
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

    const textFields = [
      "name",
      "email",
      "loginMethod",
      "passwordHash",
      "school",
      "subject",
      "grade",
      "bio",
    ] as const;
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

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

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

export async function getKnowledgeFilesByUserId(
  userId: number,
  options?: { folderId?: number; tagIds?: number[] }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(knowledgeFiles.userId, userId)];
  if (options?.folderId !== undefined) {
    conditions.push(eq(knowledgeFiles.folderId, options.folderId));
  }
  if (options?.tagIds && options.tagIds.length > 0) {
    const tagFilter = db
      .select({ fileId: knowledgeFileTags.knowledgeFileId })
      .from(knowledgeFileTags)
      .where(
        and(
          eq(knowledgeFileTags.userId, userId),
          inArray(knowledgeFileTags.tagId, options.tagIds)
        )
      );
    conditions.push(inArray(knowledgeFiles.id, tagFilter));
  }

  return await db
    .select()
    .from(knowledgeFiles)
    .where(and(...conditions))
    .orderBy(desc(knowledgeFiles.createdAt));
}

export async function deleteKnowledgeFile(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete associated chunks first
  await db
    .delete(knowledgeChunks)
    .where(eq(knowledgeChunks.knowledgeFileId, id));
  await db
    .delete(knowledgeFiles)
    .where(and(eq(knowledgeFiles.id, id), eq(knowledgeFiles.userId, userId)));
}

export async function getKnowledgeFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getKnowledgeFilesByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(knowledgeFiles)
    .where(inArray(knowledgeFiles.id, ids));
}

export async function updateKnowledgeFile(
  id: number,
  updates: Partial<InsertKnowledgeFile>
) {
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

  await db
    .delete(knowledgeChunks)
    .where(eq(knowledgeChunks.knowledgeFileId, knowledgeFileId));
}

// Generation History
export async function createGenerationHistory(
  history: InsertGenerationHistory
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(generationHistory).values(history);
  return result;
}

export async function createGenerationHistoryVersion(
  version: InsertGenerationHistoryVersion
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(generationHistoryVersions).values(version);
}

export async function getGenerationHistoryVersions(generationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(generationHistoryVersions)
    .where(eq(generationHistoryVersions.generationId, generationId))
    .orderBy(desc(generationHistoryVersions.versionNo));
}

export async function getLatestGenerationVersionNo(generationId: number) {
  const db = await getDb();
  if (!db) return 0;
  const versions = await db
    .select({ versionNo: generationHistoryVersions.versionNo })
    .from(generationHistoryVersions)
    .where(eq(generationHistoryVersions.generationId, generationId))
    .orderBy(desc(generationHistoryVersions.versionNo))
    .limit(1);
  return versions[0]?.versionNo ?? 0;
}

export async function getGenerationHistoryByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(generationHistory)
    .where(eq(generationHistory.userId, userId))
    .orderBy(desc(generationHistory.createdAt));
}

export async function getGenerationHistoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(generationHistory)
    .where(eq(generationHistory.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateGenerationHistory(
  id: number,
  updates: Partial<InsertGenerationHistory>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(generationHistory)
    .set(updates)
    .where(eq(generationHistory.id, id));
}

export async function deleteGenerationHistory(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(generationHistory)
    .where(
      and(eq(generationHistory.id, id), eq(generationHistory.userId, userId))
    );
}

export async function createGenerationExportTask(task: InsertGenerationExport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(generationExports).values(task);
}

export async function updateGenerationExportTask(
  id: number,
  updates: Partial<InsertGenerationExport>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(generationExports)
    .set(updates)
    .where(eq(generationExports.id, id));
}

export async function getGenerationExportTasksByHistoryId(
  generationHistoryId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(generationExports)
    .where(
      and(
        eq(generationExports.generationHistoryId, generationHistoryId),
        eq(generationExports.userId, userId)
      )
    )
    .orderBy(desc(generationExports.createdAt));
}

// Resource Templates
export async function getPublicTemplates() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(resourceTemplates)
    .where(eq(resourceTemplates.isPublic, 1))
    .orderBy(desc(resourceTemplates.usageCount));
}

export async function getUserTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(resourceTemplates)
    .where(
      and(
        eq(resourceTemplates.createdBy, userId),
        eq(resourceTemplates.isUserUploaded, 1)
      )
    )
    .orderBy(desc(resourceTemplates.createdAt));
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

  await db
    .delete(resourceTemplates)
    .where(
      and(eq(resourceTemplates.id, id), eq(resourceTemplates.createdBy, userId))
    );
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(resourceTemplates)
    .where(eq(resourceTemplates.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementTemplateUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const template = await getTemplateById(id);
  if (template) {
    await db
      .update(resourceTemplates)
      .set({ usageCount: template.usageCount + 1 })
      .where(eq(resourceTemplates.id, id));
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

  return db
    .select()
    .from(studentComments)
    .where(eq(studentComments.userId, userId))
    .orderBy(desc(studentComments.createdAt));
}

export async function getStudentCommentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(studentComments)
    .where(eq(studentComments.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStudentComment(
  id: number,
  data: Partial<InsertStudentComment>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(studentComments).set(data).where(eq(studentComments.id, id));
}

export async function deleteStudentComment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(studentComments)
    .where(and(eq(studentComments.id, id), eq(studentComments.userId, userId)));
}

export async function getClassesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(classes)
    .where(eq(classes.userId, userId))
    .orderBy(desc(classes.updatedAt));
}

export async function createClass(data: InsertClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(classes).values(data);
}

export async function getStudentsByClassId(userId: number, classId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(students)
    .where(and(eq(students.userId, userId), eq(students.classId, classId)))
    .orderBy(students.name);
}

export async function createStudents(data: InsertStudent[]) {
  if (data.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(students).values(data);
}

export async function createStudentCommentGenerations(
  data: InsertStudentCommentGeneration[]
) {
  if (data.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(studentCommentGenerations).values(data);
}

export async function getStructuredCommentHistory(
  userId: number,
  classId: number,
  term?: string
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(studentCommentGenerations.userId, userId),
    eq(studentCommentGenerations.classId, classId),
  ];
  if (term) {
    conditions.push(eq(studentCommentGenerations.term, term));
  }
  return db
    .select()
    .from(studentCommentGenerations)
    .where(and(...conditions))
    .orderBy(desc(studentCommentGenerations.generatedAt));
}

export async function getPerformanceTrend(
  userId: number,
  classId: number,
  studentId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(studentPerformanceRecords)
    .where(
      and(
        eq(studentPerformanceRecords.userId, userId),
        eq(studentPerformanceRecords.classId, classId),
        eq(studentPerformanceRecords.studentId, studentId)
      )
    )
    .orderBy(desc(studentPerformanceRecords.recordAt));
}

// Search & Filter Generation History
export async function searchGenerationHistory(
  userId: number,
  options: {
    search?: string;
    resourceType?: string;
    favoritesOnly?: boolean;
    folderId?: number;
    tagIds?: number[];
  }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(generationHistory.userId, userId)];

  if (options.resourceType) {
    conditions.push(
      sql`${generationHistory.resourceType} = ${options.resourceType}`
    );
  }

  if (options.favoritesOnly) {
    conditions.push(eq(generationHistory.isFavorite, 1));
  }

  if (options.search) {
    const searchPattern = `%${options.search}%`;
    conditions.push(
      or(
        like(generationHistory.title, searchPattern),
        like(generationHistory.prompt, searchPattern)
      )!
    );
  }

  if (options.folderId !== undefined) {
    conditions.push(eq(generationHistory.folderId, options.folderId));
  }

  if (options.tagIds && options.tagIds.length > 0) {
    const generationFilter = db
      .select({ generationId: generationHistoryTags.generationId })
      .from(generationHistoryTags)
      .where(
        and(
          eq(generationHistoryTags.userId, userId),
          inArray(generationHistoryTags.tagId, options.tagIds)
        )
      );
    conditions.push(inArray(generationHistory.id, generationFilter));
  }

  return await db
    .select()
    .from(generationHistory)
    .where(and(...conditions))
    .orderBy(desc(generationHistory.createdAt));
}

export async function getFoldersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(folders.name);
}

export async function createFolder(data: InsertFolder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(folders).values(data);
}

export async function getResourceTagsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(resourceTags)
    .where(eq(resourceTags.userId, userId))
    .orderBy(resourceTags.name);
}

export async function createResourceTag(data: InsertResourceTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(resourceTags).values(data);
}

export async function setKnowledgeFileTags(
  userId: number,
  knowledgeFileId: number,
  tagIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(knowledgeFileTags)
    .where(
      and(
        eq(knowledgeFileTags.userId, userId),
        eq(knowledgeFileTags.knowledgeFileId, knowledgeFileId)
      )
    );
  if (tagIds.length > 0) {
    await db
      .insert(knowledgeFileTags)
      .values(tagIds.map(tagId => ({ userId, knowledgeFileId, tagId })));
  }
}

export async function setGenerationTags(
  userId: number,
  generationId: number,
  tagIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(generationHistoryTags)
    .where(
      and(
        eq(generationHistoryTags.userId, userId),
        eq(generationHistoryTags.generationId, generationId)
      )
    );
  if (tagIds.length > 0) {
    await db
      .insert(generationHistoryTags)
      .values(tagIds.map(tagId => ({ userId, generationId, tagId })));
  }
}

// Toggle Favorite
export async function toggleFavorite(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const record = await db
    .select()
    .from(generationHistory)
    .where(
      and(eq(generationHistory.id, id), eq(generationHistory.userId, userId))
    )
    .limit(1);

  if (record.length === 0) throw new Error("记录不存在");

  const newValue = record[0].isFavorite === 1 ? 0 : 1;
  await db
    .update(generationHistory)
    .set({ isFavorite: newValue })
    .where(eq(generationHistory.id, id));

  return newValue;
}

// Share/Unshare
export async function toggleShare(
  id: number,
  userId: number,
  shareToken: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const record = await db
    .select()
    .from(generationHistory)
    .where(
      and(eq(generationHistory.id, id), eq(generationHistory.userId, userId))
    )
    .limit(1);

  if (record.length === 0) throw new Error("记录不存在");

  const isCurrentlyShared = record[0].isShared === 1;
  await db
    .update(generationHistory)
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

  return await db
    .select({
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

  const result = await db
    .select()
    .from(generationHistory)
    .where(
      and(
        eq(generationHistory.shareToken, token),
        eq(generationHistory.isShared, 1)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function mergeContent(base: string, incoming: string, current: string) {
  if (current === base) return incoming;
  if (incoming === current) return current;
  if (incoming === base) return current;
  return `${current}

<<<<<<< 新提交
${incoming}
>>>>>>>`;
}

export async function getOrCreateCollaborationSession(
  generationId: number,
  ownerId: number,
  seedContent: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const found = await db
    .select()
    .from(collaborationSessions)
    .where(eq(collaborationSessions.generationId, generationId))
    .limit(1);
  if (found.length > 0) return found[0];

  await db.insert(collaborationSessions).values({
    generationId,
    ownerId,
    participants: [{ userId: ownerId, permission: "edit" }],
    docContent: seedContent,
    revision: 1,
  });

  const created = await db
    .select()
    .from(collaborationSessions)
    .where(eq(collaborationSessions.generationId, generationId))
    .limit(1);
  return created[0];
}

export async function syncCollaborationDocument(
  generationId: number,
  content: string,
  baseRevision: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(collaborationSessions)
    .where(eq(collaborationSessions.generationId, generationId))
    .limit(1);
  if (!rows[0]) throw new Error("协作会话不存在");
  const session = rows[0];

  const merged =
    baseRevision === session.revision
      ? content
      : mergeContent(session.docContent, content, session.docContent);
  const nextRevision = session.revision + 1;

  await db
    .update(collaborationSessions)
    .set({ docContent: merged, revision: nextRevision })
    .where(eq(collaborationSessions.id, session.id));
  return { content: merged, revision: nextRevision };
}

export async function updatePresence(
  generationId: number,
  userId: number,
  state: "online" | "idle" | "offline",
  cursorAnchor?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(resourcePresence)
    .values({
      generationId,
      userId,
      state,
      cursorAnchor,
      lastSeenAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        state,
        cursorAnchor: cursorAnchor ?? null,
        lastSeenAt: new Date(),
      },
    });
}

export async function listPresence(generationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(resourcePresence)
    .where(eq(resourcePresence.generationId, generationId));
}

export async function addResourceComment(data: {
  generationId: number;
  anchor: string;
  content: string;
  authorId: number;
  parentId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(resourceComments).values(data);
}

export async function listResourceComments(generationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(resourceComments)
    .where(eq(resourceComments.generationId, generationId))
    .orderBy(desc(resourceComments.createdAt));
}

export async function updateResourceCommentStatus(
  id: number,
  status: "open" | "resolved"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(resourceComments)
    .set({ status })
    .where(eq(resourceComments.id, id));
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { systemTopics, subjects, textbookMappings } from '../../src/db/schema.js';
import { eq, and, or, ilike, sql, asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const { grade, subject, term, language, search, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];

  if (grade) conditions.push(eq(systemTopics.grade, parseInt(grade as string)));
  if (subject) conditions.push(eq(subjects.name, subject as string));
  if (term) conditions.push(eq(systemTopics.term, parseInt(term as string)));
  if (language) conditions.push(eq(systemTopics.language, language as string));
  if (search) conditions.push(or(ilike(systemTopics.submoduleName, `%${search}%`), ilike(systemTopics.topicName, `%${search}%`)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: systemTopics.id,
      language: systemTopics.language,
      grade: systemTopics.grade,
      subjectName: subjects.name,
      term: systemTopics.term,
      topicName: systemTopics.topicName,
      submoduleName: systemTopics.submoduleName,
      submoduleId: systemTopics.submoduleId,
      mappingCount: sql<number>`count(${textbookMappings.id})::int`,
    })
    .from(systemTopics)
    .innerJoin(subjects, eq(systemTopics.subjectId, subjects.id))
    .leftJoin(textbookMappings, eq(systemTopics.id, textbookMappings.systemTopicId))
    .where(where)
    .groupBy(systemTopics.id, subjects.name)
    .orderBy(asc(systemTopics.grade), asc(subjects.name), asc(systemTopics.term), asc(systemTopics.topicName))
    .limit(limitNum)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(distinct ${systemTopics.id})::int` })
    .from(systemTopics)
    .innerJoin(subjects, eq(systemTopics.subjectId, subjects.id))
    .where(where);

  const total = countResult[0]?.count ?? 0;

  res.json({
    topics: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}

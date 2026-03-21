import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { systemTopics, textbookMappings, subjects } from '../../src/db/schema.js';
import { sql, eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const totalResult = await db.select({ count: sql<number>`count(*)::int` }).from(systemTopics);
  const totalTopics = totalResult[0]?.count ?? 0;

  const mappedResult = await db
    .select({ count: sql<number>`count(distinct ${textbookMappings.systemTopicId})::int` })
    .from(textbookMappings);
  const mappedTopics = mappedResult[0]?.count ?? 0;

  const totalMappingsResult = await db.select({ count: sql<number>`count(*)::int` }).from(textbookMappings);
  const totalMappings = totalMappingsResult[0]?.count ?? 0;

  const gradeStats = await db
    .select({
      grade: systemTopics.grade,
      totalTopics: sql<number>`count(distinct ${systemTopics.id})::int`,
      mappedTopics: sql<number>`count(distinct ${textbookMappings.systemTopicId})::int`,
    })
    .from(systemTopics)
    .leftJoin(textbookMappings, eq(systemTopics.id, textbookMappings.systemTopicId))
    .groupBy(systemTopics.grade)
    .orderBy(systemTopics.grade);

  const subjectStats = await db
    .select({
      subjectName: subjects.name,
      totalTopics: sql<number>`count(distinct ${systemTopics.id})::int`,
      mappedTopics: sql<number>`count(distinct ${textbookMappings.systemTopicId})::int`,
    })
    .from(systemTopics)
    .innerJoin(subjects, eq(systemTopics.subjectId, subjects.id))
    .leftJoin(textbookMappings, eq(systemTopics.id, textbookMappings.systemTopicId))
    .groupBy(subjects.name)
    .orderBy(subjects.name);

  res.json({
    totalTopics,
    mappedTopics,
    totalMappings,
    percentMapped: totalTopics > 0 ? Math.round((mappedTopics / totalTopics) * 100) : 0,
    gradeStats,
    subjectStats,
  });
}

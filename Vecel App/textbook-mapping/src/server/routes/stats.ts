import { Router } from 'express';
import { db } from '../../db/index.js';
import { systemTopics, textbookMappings, subjects } from '../../db/schema.js';
import { sql, eq } from 'drizzle-orm';

export const statsRouter = Router();

// GET /api/stats — Dashboard statistics
statsRouter.get('/', async (_req, res) => {
  try {
    // Total topics
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemTopics);
    const totalTopics = totalResult[0]?.count ?? 0;

    // Topics with at least one mapping
    const mappedResult = await db
      .select({ count: sql<number>`count(distinct ${textbookMappings.systemTopicId})::int` })
      .from(textbookMappings);
    const mappedTopics = mappedResult[0]?.count ?? 0;

    // Total mappings
    const totalMappingsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(textbookMappings);
    const totalMappings = totalMappingsResult[0]?.count ?? 0;

    // Per-grade stats
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

    // Per-subject stats
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
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

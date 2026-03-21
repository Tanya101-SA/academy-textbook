import { Router } from 'express';
import { db } from '../../db/index.js';
import { systemTopics, subjects, textbookMappings, publishers } from '../../db/schema.js';
import { eq, and, ilike, sql, asc } from 'drizzle-orm';

export const topicsRouter = Router();

// GET /api/topics — Browse with filters
topicsRouter.get('/', async (req, res) => {
  try {
    const { grade, subject, term, language, search, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    if (grade) conditions.push(eq(systemTopics.grade, parseInt(grade as string)));
    if (subject) conditions.push(eq(subjects.name, subject as string));
    if (term) conditions.push(eq(systemTopics.term, parseInt(term as string)));
    if (language) conditions.push(eq(systemTopics.language, language as string));
    if (search) conditions.push(ilike(systemTopics.submoduleName, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Get topics with mapping count
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

    // Get total count for pagination
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
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/topics/subjects — Get unique subjects, optionally filtered by grade
topicsRouter.get('/subjects', async (req, res) => {
  try {
    const { grade } = req.query;

    if (grade) {
      const rows = await db
        .selectDistinct({ name: subjects.name })
        .from(subjects)
        .innerJoin(systemTopics, eq(subjects.id, systemTopics.subjectId))
        .where(eq(systemTopics.grade, parseInt(grade as string)))
        .orderBy(asc(subjects.name));
      res.json(rows.map((r) => r.name));
    } else {
      const rows = await db
        .select({ name: subjects.name })
        .from(subjects)
        .orderBy(asc(subjects.name));
      res.json(rows.map((r) => r.name));
    }
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// GET /api/topics/:id — Single topic with all mappings
topicsRouter.get('/:id', async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);

    const topic = await db
      .select({
        id: systemTopics.id,
        language: systemTopics.language,
        grade: systemTopics.grade,
        subjectName: subjects.name,
        term: systemTopics.term,
        topicName: systemTopics.topicName,
        submoduleName: systemTopics.submoduleName,
        submoduleId: systemTopics.submoduleId,
      })
      .from(systemTopics)
      .innerJoin(subjects, eq(systemTopics.subjectId, subjects.id))
      .where(eq(systemTopics.id, topicId))
      .limit(1);

    if (topic.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const mappings = await db
      .select({
        id: textbookMappings.id,
        publisherId: publishers.id,
        publisherName: publishers.name,
        textbookTopicName: textbookMappings.textbookTopicName,
        notes: textbookMappings.notes,
        updatedAt: textbookMappings.updatedAt,
      })
      .from(textbookMappings)
      .innerJoin(publishers, eq(textbookMappings.publisherId, publishers.id))
      .where(eq(textbookMappings.systemTopicId, topicId))
      .orderBy(asc(publishers.name));

    res.json({ ...topic[0], mappings });
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

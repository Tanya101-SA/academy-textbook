import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { systemTopics, subjects, textbookMappings, publishers } from '../../src/db/schema.js';
import { eq, asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const topicId = parseInt(req.query.id as string);

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
      textbookTopic: textbookMappings.textbookTopic,
      textbookTopicName: textbookMappings.textbookTopicName,
      notes: textbookMappings.notes,
      updatedAt: textbookMappings.updatedAt,
    })
    .from(textbookMappings)
    .innerJoin(publishers, eq(textbookMappings.publisherId, publishers.id))
    .where(eq(textbookMappings.systemTopicId, topicId))
    .orderBy(asc(publishers.name));

  res.json({ ...topic[0], mappings });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { systemTopics, subjects, textbookMappings, publishers } from '../../src/db/schema.js';
import { eq, and, asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const { language, grade, subject, publisher } = req.query;
  if (!language || !grade || !subject || !publisher) {
    return res.status(400).json({ error: 'language, grade, subject, publisher are required' });
  }

  try {
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
        mappingId: textbookMappings.id,
        publisherId: publishers.id,
        publisherName: publishers.name,
        textbookTopic: textbookMappings.textbookTopic,
        textbookTopicName: textbookMappings.textbookTopicName,
        notes: textbookMappings.notes,
        updatedAt: textbookMappings.updatedAt,
      })
      .from(systemTopics)
      .innerJoin(subjects, eq(systemTopics.subjectId, subjects.id))
      .leftJoin(
        textbookMappings,
        and(
          eq(textbookMappings.systemTopicId, systemTopics.id),
          eq(textbookMappings.publisherId, publishers.id),
        ),
      )
      .innerJoin(publishers, eq(publishers.name, publisher as string))
      .where(
        and(
          eq(systemTopics.language, language as string),
          eq(systemTopics.grade, parseInt(grade as string, 10)),
          eq(subjects.name, subject as string),
        ),
      )
      .orderBy(asc(systemTopics.term), asc(systemTopics.topicName), asc(systemTopics.submoduleId));

    res.json({
      language,
      grade: parseInt(grade as string, 10),
      subject,
      publisher,
      topics: rows,
    });
  } catch (error) {
    console.error('Error fetching textbook mappings:', error);
    res.status(500).json({ error: 'Failed to fetch textbook mappings' });
  }
}

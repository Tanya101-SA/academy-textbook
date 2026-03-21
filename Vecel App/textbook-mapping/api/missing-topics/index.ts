import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { missingTextbookTopics, publishers, subjects } from '../../src/db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: missingTextbookTopics.id,
        publisherId: missingTextbookTopics.publisherId,
        publisherName: publishers.name,
        grade: missingTextbookTopics.grade,
        subjectId: missingTextbookTopics.subjectId,
        subjectName: subjects.name,
        term: missingTextbookTopics.term,
        topic: missingTextbookTopics.topic,
        subTopic: missingTextbookTopics.subTopic,
        createdAt: missingTextbookTopics.createdAt,
      })
      .from(missingTextbookTopics)
      .innerJoin(publishers, eq(missingTextbookTopics.publisherId, publishers.id))
      .innerJoin(subjects, eq(missingTextbookTopics.subjectId, subjects.id))
      .orderBy(desc(missingTextbookTopics.createdAt));

    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { publisherId, grade, subjectId, term, topic, subTopic } = req.body;

    if (!publisherId || !grade || !subjectId || !term || !topic) {
      return res.status(400).json({ error: 'publisherId, grade, subjectId, term, and topic are required' });
    }

    try {
      const result = await db
        .insert(missingTextbookTopics)
        .values({
          publisherId,
          grade: parseInt(grade),
          subjectId,
          term: parseInt(term),
          topic: topic.trim(),
          subTopic: subTopic?.trim() || null,
        })
        .returning();
      return res.status(201).json(result[0]);
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to create entry' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}

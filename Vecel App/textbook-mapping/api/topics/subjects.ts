import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { systemTopics, subjects } from '../../src/db/schema.js';
import { eq, asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const { grade } = req.query;

  if (grade) {
    const rows = await db
      .selectDistinct({ name: subjects.name })
      .from(subjects)
      .innerJoin(systemTopics, eq(subjects.id, systemTopics.subjectId))
      .where(eq(systemTopics.grade, parseInt(grade as string)))
      .orderBy(asc(subjects.name));
    res.json(rows.map((r) => r.name));
  } else if (req.query.withIds === 'true') {
    const rows = await db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .orderBy(asc(subjects.name));
    res.json(rows);
  } else {
    const rows = await db
      .select({ name: subjects.name })
      .from(subjects)
      .orderBy(asc(subjects.name));
    res.json(rows.map((r) => r.name));
  }
}

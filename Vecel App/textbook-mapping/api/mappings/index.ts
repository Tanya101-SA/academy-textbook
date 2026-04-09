import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { textbookMappings } from '../../src/db/schema.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemTopicId, publisherId, textbookTopic, textbookTopicName, notes } = req.body;

  if (!systemTopicId || !publisherId) {
    return res.status(400).json({ error: 'systemTopicId and publisherId are required' });
  }

  try {
    const result = await db
      .insert(textbookMappings)
      .values({ systemTopicId, publisherId, textbookTopic: textbookTopic || null, textbookTopicName: textbookTopicName || '', notes: notes || null, updatedBy: user.email, source: 'manual' })
      .returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

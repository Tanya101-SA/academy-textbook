import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { textbookMappings } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const id = parseInt(req.query.id as string);

  if (req.method === 'PUT') {
    const { textbookTopic, textbookTopicName, notes } = req.body;
    const result = await db
      .update(textbookMappings)
      .set({ textbookTopic: textbookTopic || null, textbookTopicName, notes: notes || null, updatedBy: user.email, updatedAt: new Date(), source: 'manual' })
      .where(eq(textbookMappings.id, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: 'Mapping not found' });
    return res.json(result[0]);
  }

  if (req.method === 'DELETE') {
    const result = await db
      .delete(textbookMappings)
      .where(eq(textbookMappings.id, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: 'Mapping not found' });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

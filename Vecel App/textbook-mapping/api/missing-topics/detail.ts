import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { missingTextbookTopics } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const id = parseInt(req.query.id as string);

  if (req.method === 'DELETE') {
    const result = await db
      .delete(missingTextbookTopics)
      .where(eq(missingTextbookTopics.id, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: 'Entry not found' });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

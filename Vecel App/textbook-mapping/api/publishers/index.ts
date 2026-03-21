import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { publishers } from '../../src/db/schema.js';
import { asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Not authenticated' });

  const rows = await db.select().from(publishers).orderBy(asc(publishers.name));
  res.json(rows);
}

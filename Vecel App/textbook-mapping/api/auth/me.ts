import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, authUser.userId))
    .limit(1);

  if (user.length === 0) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.json(user[0]);
}

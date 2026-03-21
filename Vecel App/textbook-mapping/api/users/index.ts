import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../_auth.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { asc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = verifyToken(req);
  if (!authUser) return res.status(401).json({ error: 'Not authenticated' });
  if (authUser.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  // GET — list all users
  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));
    return res.json(rows);
  }

  // POST — create a new user
  if (req.method === 'POST') {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await db
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          name,
          role: role || 'user',
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        });
      res.status(201).json(result[0]);
    } catch (error: any) {
      if (error.message?.includes('users_email_unique')) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
}

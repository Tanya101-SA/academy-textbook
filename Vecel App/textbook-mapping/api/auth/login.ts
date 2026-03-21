import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { createToken } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (user.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user[0].passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createToken({
    userId: user[0].id,
    email: user[0].email,
    role: user[0].role,
  });

  res.json({
    token,
    user: {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role,
    },
  });
}

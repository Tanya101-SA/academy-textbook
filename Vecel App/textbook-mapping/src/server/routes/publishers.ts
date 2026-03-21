import { Router } from 'express';
import { db } from '../../db/index.js';
import { publishers } from '../../db/schema.js';
import { asc } from 'drizzle-orm';

export const publishersRouter = Router();

// GET /api/publishers — List all publishers
publishersRouter.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(publishers)
      .orderBy(asc(publishers.name));
    res.json(rows);
  } catch (error) {
    console.error('Error fetching publishers:', error);
    res.status(500).json({ error: 'Failed to fetch publishers' });
  }
});

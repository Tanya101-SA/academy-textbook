import { Router } from 'express';
import { db } from '../../db/index.js';
import { textbookMappings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export const mappingsRouter = Router();

// POST /api/mappings — Add a new mapping
mappingsRouter.post('/', async (req, res) => {
  try {
    const { systemTopicId, publisherId, textbookTopicName, notes } = req.body;

    if (!systemTopicId || !publisherId || !textbookTopicName) {
      return res.status(400).json({ error: 'systemTopicId, publisherId, and textbookTopicName are required' });
    }

    const result = await db
      .insert(textbookMappings)
      .values({
        systemTopicId,
        publisherId,
        textbookTopicName,
        notes: notes || null,
      })
      .returning();

    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.message?.includes('unique_mapping')) {
      return res.status(409).json({ error: 'A mapping already exists for this topic and publisher' });
    }
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// PUT /api/mappings/:id — Update a mapping
mappingsRouter.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { textbookTopicName, notes } = req.body;

    const result = await db
      .update(textbookMappings)
      .set({
        textbookTopicName,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(textbookMappings.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error updating mapping:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// DELETE /api/mappings/:id — Delete a mapping
mappingsRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const result = await db
      .delete(textbookMappings)
      .where(eq(textbookMappings.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

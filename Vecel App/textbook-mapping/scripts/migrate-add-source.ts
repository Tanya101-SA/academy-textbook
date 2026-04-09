import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

async function migrateAddSource() {
  console.log('Adding source column to textbook_mappings...');

  // Add the column
  await sql`ALTER TABLE textbook_mappings ADD COLUMN source VARCHAR(20) DEFAULT 'manual'`;

  console.log('Column added. Tagging existing mappings...');

  // Tag auto-matched rows
  const autoMatchedResult = await db.execute(sql`
    UPDATE textbook_mappings
    SET source = 'auto'
    WHERE notes LIKE '%auto-matched%' OR notes LIKE '%similarity%'
  `);

  console.log(`Tagged ${autoMatchedResult.rowCount} auto-matched rows as 'auto'`);

  // Manual mappings are already default 'manual'
  const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM textbook_mappings`);
  const manualCount = totalResult.rows[0].total - autoMatchedResult.rowCount;

  console.log(`Preserved ${manualCount} manual mappings as 'manual'`);

  console.log('Migration completed successfully.');
}

migrateAddSource().catch(console.error);
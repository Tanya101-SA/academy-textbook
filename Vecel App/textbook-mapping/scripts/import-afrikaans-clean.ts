/**
 * Clean import of Afrikaans topics + publisher mappings
 *
 * 1. Deletes ALL existing Afrikaans system_topics and their textbook_mappings
 * 2. Reimports from "Akademie Onderwerpe vs Lesonderwerpe v2.xlsx"
 *    (pre-computed SubModule IDs, Afrikaans subject names, 32 publisher columns)
 *
 * Usage:  npx tsx scripts/import-afrikaans-clean.ts
 */

import XLSX from 'xlsx';
import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

const EXCEL_PATH =
  'C:/Users/NicolaCrous/OneDrive - Speccon Holdings (Pty) Ltd/SpecCon Academy - Textbooks/Spreadsheets/Akademie Onderwerpe vs Lesonderwerpe v2.xlsx';

const GRADE_SHEETS = [
  'Graad 4', 'Graad 5', 'Graad 6', 'Graad 7', 'Graad 8', 'Graad 9',
  'Graad 10', 'Graad 11', 'Graad 12',
];

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getOrCreateSubject(
  name: string,
  cache: Map<string, number>
): Promise<number> {
  if (cache.has(name)) return cache.get(name)!;
  const existing = await db.select().from(subjects).where(eq(subjects.name, name)).limit(1);
  if (existing.length > 0) {
    cache.set(name, existing[0].id);
    return existing[0].id;
  }
  const [ins] = await db.insert(subjects).values({ name }).returning({ id: subjects.id });
  cache.set(name, ins.id);
  console.log(`  Created subject: "${name}"`);
  return ins.id;
}

async function getOrCreatePublisher(
  name: string,
  cache: Map<string, number>
): Promise<number> {
  if (cache.has(name)) return cache.get(name)!;
  const existing = await db.select().from(publishers).where(eq(publishers.name, name)).limit(1);
  if (existing.length > 0) {
    cache.set(name, existing[0].id);
    return existing[0].id;
  }
  const [ins] = await db.insert(publishers).values({ name }).returning({ id: publishers.id });
  cache.set(name, ins.id);
  console.log(`  Created publisher: "${name}"`);
  return ins.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Clean Import: Afrikaans Topics + Mappings ===\n');

  // ── Phase 1: Delete existing Afrikaans data ──
  console.log('--- Phase 1: Delete existing Afrikaans topics ---');

  const afTopics = await db
    .select({ id: systemTopics.id })
    .from(systemTopics)
    .where(eq(systemTopics.language, 'Afrikaans'));

  const afTopicIds = afTopics.map(t => t.id);
  console.log(`Found ${afTopicIds.length} existing Afrikaans topics`);

  if (afTopicIds.length > 0) {
    // Delete mappings in batches (avoid huge IN clauses)
    let deletedMappings = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < afTopicIds.length; i += BATCH_SIZE) {
      const batch = afTopicIds.slice(i, i + BATCH_SIZE);
      const result = await db
        .delete(textbookMappings)
        .where(inArray(textbookMappings.systemTopicId, batch))
        .returning({ id: textbookMappings.id });
      deletedMappings += result.length;
    }
    console.log(`Deleted ${deletedMappings} textbook mappings`);

    // Delete the topics themselves
    const deletedTopics = await db
      .delete(systemTopics)
      .where(eq(systemTopics.language, 'Afrikaans'))
      .returning({ id: systemTopics.id });
    console.log(`Deleted ${deletedTopics.length} Afrikaans topics`);
  }

  // ── Phase 2: Read Excel and import ──
  console.log('\n--- Phase 2: Import from Afrikaans Excel ---');
  console.log(`Reading: ${EXCEL_PATH}\n`);

  const wb = XLSX.readFile(EXCEL_PATH);
  console.log('Sheets found:', wb.SheetNames.join(', '), '\n');

  const subjectCache = new Map<string, number>();
  const publisherCache = new Map<string, number>();

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalMappings = 0;
  let totalErrors = 0;

  for (const sheetName of GRADE_SHEETS) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`Sheet "${sheetName}" not found — skipping`);
      continue;
    }

    console.log(`\n--- ${sheetName} ---`);

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as (any[] | null)[];

    if (!rows || rows.length < 2) {
      console.log('  No data rows');
      continue;
    }

    // Read publisher columns from header row
    const headerRow = rows[0];
    const publisherCols = new Map<number, string>();
    if (headerRow) {
      for (let i = 7; i < headerRow.length; i++) {
        const h = headerRow[i] != null ? String(headerRow[i]).trim() : '';
        if (h) publisherCols.set(i, h);
      }
    }
    console.log(`  Publisher columns: ${publisherCols.size}`);

    let sheetInserted = 0;
    let sheetMappings = 0;

    // Process data rows (skip header at index 0)
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;

      const language = row[0] != null ? String(row[0]).trim() : '';
      const gradeStr = row[1] != null ? String(row[1]).trim() : '';
      const subjectName = row[2] != null ? String(row[2]).trim() : '';
      const termStr = row[3] != null ? String(row[3]).trim() : '';
      const topicName = row[4] != null ? String(row[4]).trim() : '';
      const submoduleName = row[5] != null ? String(row[5]).trim() : '';
      const submoduleIdStr = row[6] != null ? String(row[6]).trim() : '';

      // Skip subject separator rows (only col 0 filled) or empty rows
      if (!language || !subjectName || !submoduleName || !submoduleIdStr) continue;

      const grade = parseInt(gradeStr);
      const term = parseInt(termStr) || 1;
      const submoduleId = parseInt(submoduleIdStr);

      if (isNaN(grade) || isNaN(submoduleId)) continue;

      const subjectId = await getOrCreateSubject(subjectName, subjectCache);

      try {
        const result = await db
          .insert(systemTopics)
          .values({
            language,
            grade,
            subjectId,
            term,
            topicName: topicName || submoduleName,
            submoduleName,
            submoduleId,
          })
          .onConflictDoNothing()
          .returning({ id: systemTopics.id });

        if (result.length > 0) {
          totalInserted++;
          sheetInserted++;
          const topicId = result[0].id;

          // Insert publisher mappings for non-empty publisher columns
          for (const [colIdx, publisherName] of publisherCols) {
            const cellValue = row[colIdx];
            if (!cellValue || !String(cellValue).trim()) continue;

            const pubId = await getOrCreatePublisher(publisherName, publisherCache);
            try {
              const mapResult = await db
                .insert(textbookMappings)
                .values({
                  systemTopicId: topicId,
                  publisherId: pubId,
                  textbookTopicName: String(cellValue).trim(),
                  createdBy: 'import-script',
                })
                .onConflictDoNothing()
                .returning({ id: textbookMappings.id });
              if (mapResult.length > 0) {
                totalMappings++;
                sheetMappings++;
              }
            } catch (e: any) {
              console.error(`  Mapping error (${publisherName}): ${e.message?.slice(0, 100)}`);
              totalErrors++;
            }
          }
        } else {
          totalSkipped++;
        }
      } catch (e: any) {
        console.error(`  Error row ${rowIdx} (${submoduleName}): ${e.message?.slice(0, 120)}`);
        totalErrors++;
      }
    }

    console.log(`  Topics inserted: ${sheetInserted}, Mappings: ${sheetMappings}`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Topics inserted  : ${totalInserted}`);
  console.log(`Duplicates skipped: ${totalSkipped}`);
  console.log(`Mappings inserted : ${totalMappings}`);
  console.log(`Errors           : ${totalErrors}`);
  console.log(`Subjects used    : ${subjectCache.size}`);
  console.log(`Publishers used  : ${publisherCache.size}`);
  console.log('\nDone! Topics are now visible at /topics?language=Afrikaans');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

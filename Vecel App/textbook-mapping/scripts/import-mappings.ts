import XLSX from 'xlsx';
import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import path from 'path';

const PUBLISHER_NAMES = [
  'Achieve Careers',
  'Afrikaans sonder grense',
  'AmaniYah Publishers',
  'Better Books',
  'Bloomsbury',
  'Cambridge University Press SA',
  'Consumo Publishers',
  'Department of Basic Education',
  'English in Context',
  'Focus',
  'Funworks',
  'ITSI Holdings',
  'JNM Publishers',
  'Laerskool Impala Vraestelle',
  'MDP Education',
  'MTN Publishing',
  'Macmillan',
  'Maskew Miller Learning',
  'Mind Action Series',
  'New Era',
  'Optimi',
  'Oxford',
  'Platinum',
  'Play Mathematics',
  'Sasol Inzalo Foundation',
  'Shuter and Shooter',
  'Siyavula Education',
  'Solutions for All',
  'Spot On',
  'Study Opportunities',
  'Via Afrika',
  'Vivlia',
];

const SHEETS_TO_IMPORT = [
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
];

async function main() {
  const excelPath = path.resolve(
    'C:/Users/tanya/Speccon Holdings (Pty) Ltd/SpecCon Academy - Documents/Textbooks/Spreadsheets/Topics by Grade (Tanya) - Matched (Updated).xlsx'
  );

  console.log('Reading Excel file...');
  const wb = XLSX.readFile(excelPath);
  console.log('Sheets found:', wb.SheetNames);

  // Load all publishers into a map
  const allPublishers = await db.select().from(publishers);
  const publisherMap = new Map<string, number>();
  for (const p of allPublishers) {
    publisherMap.set(p.name, p.id);
  }
  console.log(`Loaded ${publisherMap.size} publishers from DB`);

  // Load all system topics into a lookup map by submoduleId
  const allTopics = await db.select().from(systemTopics);
  const topicBySubmoduleId = new Map<number, typeof allTopics[0]>();
  for (const t of allTopics) {
    topicBySubmoduleId.set(t.submoduleId, t);
  }
  console.log(`Loaded ${topicBySubmoduleId.size} system topics from DB`);

  let totalMappings = 0;
  let skippedNoTopic = 0;
  let skippedDuplicate = 0;
  let errors = 0;

  for (const sheetName of SHEETS_TO_IMPORT) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`Sheet "${sheetName}" not found, skipping`);
      continue;
    }

    console.log(`\n--- Processing: ${sheetName} ---`);
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    if (rows.length < 2) continue;

    // Get header row to find publisher column indices
    const headers = rows[0].map((h: any) => (h ? String(h).trim() : ''));
    const publisherColMap = new Map<number, string>();
    for (let i = 7; i < headers.length; i++) {
      if (headers[i] && PUBLISHER_NAMES.includes(headers[i])) {
        publisherColMap.set(i, headers[i]);
      }
    }
    console.log(`  Found ${publisherColMap.size} publisher columns`);

    let sheetMappings = 0;

    // Process data rows
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || !row[0] || !row[2]) continue;

      const submoduleId = parseInt(String(row[6]));
      if (isNaN(submoduleId)) continue;

      // Find the system topic by submoduleId
      const topic = topicBySubmoduleId.get(submoduleId);
      if (!topic) {
        skippedNoTopic++;
        continue;
      }

      // Check each publisher column for mapping data
      for (const [colIdx, publisherName] of publisherColMap) {
        const cellValue = row[colIdx];
        if (!cellValue || !String(cellValue).trim()) continue;

        const textbookTopicName = String(cellValue).trim();
        const pubId = publisherMap.get(publisherName);
        if (!pubId) continue;

        try {
          const result = await db
            .insert(textbookMappings)
            .values({
              systemTopicId: topic.id,
              publisherId: pubId,
              textbookTopicName,
            })
            .onConflictDoNothing()
            .returning();

          if (result.length > 0) {
            totalMappings++;
            sheetMappings++;
          } else {
            skippedDuplicate++;
          }
        } catch (e: any) {
          errors++;
          if (errors <= 5) {
            console.error(`  Error: ${publisherName} -> "${textbookTopicName}" for topic ${submoduleId}:`, e.message?.slice(0, 100));
          }
        }
      }
    }

    console.log(`  Imported ${sheetMappings} mappings from ${sheetName}`);
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`New mappings imported: ${totalMappings}`);
  console.log(`Skipped (topic not in DB): ${skippedNoTopic}`);
  console.log(`Skipped (already existed): ${skippedDuplicate}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);

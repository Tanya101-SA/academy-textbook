import XLSX from 'xlsx';
import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Publisher columns (from the spreadsheet headers) ───
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

// ─── Sheets to import (use the well-structured ones) ───
const SHEETS_TO_IMPORT = [
  'Grade 4 (Rename)',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

async function main() {
  const excelPath = path.resolve(
    'C:/Users/tanya/Speccon Holdings (Pty) Ltd/SpecCon Academy - Documents/Textbooks/Spreadsheets/Topics by Grade (Tanya) - Matched.xlsx'
  );

  // Try to copy the file first if it's locked (OneDrive/SharePoint)
  let workbookPath = excelPath;
  try {
    const wb = XLSX.readFile(workbookPath);
    console.log('Excel file opened successfully');
  } catch (e: any) {
    if (e.code === 'EACCES' || e.message?.includes('Permission')) {
      // Try copying to temp location
      const tempPath = path.resolve(__dirname, '../temp-import.xlsx');
      const fs = await import('fs');
      fs.copyFileSync(excelPath, tempPath);
      workbookPath = tempPath;
      console.log('Copied to temp location (file was locked)');
    } else {
      throw e;
    }
  }

  const wb = XLSX.readFile(workbookPath);
  console.log('Sheets found:', wb.SheetNames);

  // ─── Step 1: Insert publishers ───
  console.log('\n--- Inserting publishers ---');
  const publisherMap = new Map<string, number>();

  for (const name of PUBLISHER_NAMES) {
    const existing = await db
      .select()
      .from(publishers)
      .where(eq(publishers.name, name))
      .limit(1);

    if (existing.length > 0) {
      publisherMap.set(name, existing[0].id);
    } else {
      const result = await db
        .insert(publishers)
        .values({ name })
        .returning();
      publisherMap.set(name, result[0].id);
    }
  }
  console.log(`Inserted/found ${publisherMap.size} publishers`);

  // ─── Step 2: Import topics from each sheet ───
  const subjectMap = new Map<string, number>();
  let totalTopics = 0;
  let totalMappings = 0;

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

    // Process data rows (skip header row and subject separator rows)
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || !row[0] || !row[2]) continue; // Skip empty/separator rows

      const language = String(row[0]).trim();
      const grade = parseInt(String(row[1]));
      const subjectName = String(row[2]).trim();
      const term = parseInt(String(row[3])) || 1;
      const topicName = String(row[4] || '').trim();
      const submoduleName = String(row[5] || '').trim();
      const submoduleId = parseInt(String(row[6]));

      if (!language || !grade || !subjectName || !submoduleName || isNaN(submoduleId)) continue;

      // Get or create subject
      if (!subjectMap.has(subjectName)) {
        const existing = await db
          .select()
          .from(subjects)
          .where(eq(subjects.name, subjectName))
          .limit(1);

        if (existing.length > 0) {
          subjectMap.set(subjectName, existing[0].id);
        } else {
          const result = await db
            .insert(subjects)
            .values({ name: subjectName })
            .returning();
          subjectMap.set(subjectName, result[0].id);
        }
      }

      const subjectId = subjectMap.get(subjectName)!;

      // Insert system topic (upsert - skip if already exists)
      let topicId: number;
      try {
        const result = await db
          .insert(systemTopics)
          .values({
            language,
            grade,
            subjectId,
            term,
            topicName,
            submoduleName,
            submoduleId,
          })
          .onConflictDoNothing()
          .returning();

        if (result.length > 0) {
          topicId = result[0].id;
          totalTopics++;
        } else {
          // Already existed, look it up
          const existing = await db
            .select()
            .from(systemTopics)
            .where(eq(systemTopics.submoduleId, submoduleId))
            .limit(1);
          if (existing.length > 0) {
            topicId = existing[0].id;
          } else {
            continue;
          }
        }
      } catch (e: any) {
        console.error(`Error inserting topic: ${submoduleName} (grade ${grade})`, e.message?.slice(0, 200));
        continue;
      }

      // Insert textbook mappings from publisher columns
      for (const [colIdx, publisherName] of publisherColMap) {
        const cellValue = row[colIdx];
        if (cellValue && String(cellValue).trim()) {
          const textbookTopicName = String(cellValue).trim();
          const pubId = publisherMap.get(publisherName);
          if (!pubId) continue;

          try {
            const mapResult = await db
              .insert(textbookMappings)
              .values({
                systemTopicId: topicId,
                publisherId: pubId,
                textbookTopicName,
              })
              .onConflictDoNothing()
              .returning();
            if (mapResult.length > 0) totalMappings++;
          } catch (e: any) {
            console.error(`Error inserting mapping: ${publisherName} -> ${textbookTopicName}`, e.message?.slice(0, 200));
          }
        }
      }
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Topics imported: ${totalTopics}`);
  console.log(`Subjects: ${subjectMap.size}`);
  console.log(`Publishers: ${publisherMap.size}`);
  console.log(`Mappings imported: ${totalMappings}`);
}

main().catch(console.error);

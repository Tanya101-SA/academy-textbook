/**
 * Import Afrikaans system topics from Textbook Topic Mapping v2.xlsx
 *
 * Reads the v2 Excel file and imports all Afrikaans-language topics into the
 * system_topics table with language="Afrikaans".
 *
 * - Grades 4–9:   Afrikaans sections identified by heading
 *                 (e.g. "Afrikaans Eerste Addisionele Taal", "Afrikaans Huistaal")
 * - Grades 10–12: Afrikaans rows detected by Afrikaans vocabulary in topic/sub-topic text
 *
 * Usage:  npx tsx scripts/import-v2-afrikaans.ts
 */

import XLSX from 'xlsx';
import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const EXCEL_PATH =
  'C:/Users/NicolaCrous/OneDrive - Speccon Holdings (Pty) Ltd/SpecCon Academy - Textbooks/Textbook Topic Mapping v2.xlsx';

const GRADE_SHEETS = [
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9',
  'Grade 10', 'Grade 11', 'Grade 12',
];

// Section headings that identify Afrikaans-medium content (Grade 4–9)
const AFRIKAANS_SECTION_MARKERS = [
  'eerste addisionele taal',
  'huistaal',
];

// Vocabulary that only appears in Afrikaans rows (used for per-row detection in ALL grades)
const AFRIKAANS_VOCAB = [
  // Accounting / Business
  'rekeningkunde', 'boekhouding', 'finansiële', 'finansiele', 'beginsels',
  'inkomstestaat', 'balansstaat', 'waardevermindering', 'joernale', 'grootboek',
  'debiteure', 'krediteure', 'vennootskap', 'maatskappy', 'kontantvloei',
  'ontleding', 'aandele', 'verdeling', 'voorraad', 'bankrekonsiliasie',
  'etiek', 'ekonomie', 'besigheidstudies', 'bedryfskoste', 'uitgawes',
  'belasting', 'skuld', 'kapitaal', 'bates', 'laste', 'rekeninge', 'rekening',
  // Mathematics
  'wiskunde', 'meetkunde', 'trigonometrie', 'differensiaal', 'bereken',
  'berekening', 'vergelyking', 'bewys', 'stelling', 'formule', 'verhouding',
  // Sciences
  'fisika', 'lewenswetenskappe', 'verskynsels', 'eienskappe', 'prosesse',
  'definisie', 'verduideliking', 'biologie', 'chemie',
  // Geography / History / Social Sciences
  'geskiedenis', 'aardrykskunde', 'sosiale wetenskappe', 'nedersettings',
  'hulpbronne', 'omgewing', 'gemeenskap',
  // Life Orientation / Life Skills
  'lewensorientering', 'lewensvaardighede', 'arbeid',
  // Technology / Creative Arts
  'tegnologie', 'skeppende kunste',
  // Language topics (Afrikaans FAL / HL — Grades 4–9)
  'taalstrukture', 'konvensies', 'instruksies', 'aanwysings', 'gedig',
  'nuusberig', 'luisterbegrip', 'leesbegrip', 'hardoplees', 'mondelinge',
  'hervertelling', 'dagboekinskrywing', 'werkwoorde', 'naamwoorde',
  'voornaamwoorde', 'lidwoorde', 'meervoude', 'sinonieme', 'antonieme',
  'leestekens', 'skryftekens', 'punktuasie', 'byvoeglike', 'voorsetsels',
  'voegwoorde', 'beskrywende', 'verhalende', 'opstel', 'rolspel',
  'bespreking', 'tydsvorme', 'ontkenning', 'lydende', 'bedrywende',
  'direkte', 'indirekte', 'sinsoorte', 'sinstrukture', 'sinsuitbreiding',
  'woordsoorte', 'selfstandige', 'bywoorde', 'lees en kyk', 'luister en praat',
  'skryf en aanbied', 'alfabetiese', 'vokale', 'konsonante', 'afkortings',
  'trappe van vergelyking', 'intensiewe', 'idiome', 'lettergrepe', 'klankgrepe',
  'afleidings', 'samestellings', 'spreekwoorde', 'eufemisme', 'figuurlike',
  'alliterasie', 'assonansie', 'personifikasie',
  // General
  'algemene', 'aanvaarde', 'stelsel',
];

// ─── Language detection ───────────────────────────────────────────────────────

function isSectionAfrikaans(sectionSubject: string): boolean {
  const lower = sectionSubject.toLowerCase();
  return AFRIKAANS_SECTION_MARKERS.some(m => lower.includes(m));
}

function isAfrikaansText(topicName: string, subTopicsRaw: string): boolean {
  const text = `${topicName} ${subTopicsRaw}`;
  // "'n " (standard or curly apostrophe) is a definitive Afrikaans article
  if (text.includes("'n ") || text.includes('\u2019n ')) return true;
  const lower = text.toLowerCase();
  return AFRIKAANS_VOCAB.some(w => lower.includes(w));
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseSectionHeading(heading: string): { grade: number; subject: string } | null {
  const match = heading.match(/^Grade\s+(\d+)\s*[-–—]\s*(.+)$/i);
  if (!match) return null;
  return { grade: parseInt(match[1]), subject: match[2].trim() };
}

function parseSubTopics(cellText: string | null | undefined): string[] {
  if (!cellText) return [];
  return String(cellText)
    .split('\n')
    .map(line => line.replace(/^\*\s*/, '').replace(/\r$/, '').trim())
    .filter(line => line.length >= 3);
}

// Stable FNV-1a hash → integer in range 100000–999999
function stableId(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (Math.imul(hash, 16777619)) >>> 0;
  }
  return (hash % 900000) + 100000;
}

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
  console.log('=== Import Afrikaans Topics from Textbook Topic Mapping v2.xlsx ===\n');

  const wb = XLSX.readFile(EXCEL_PATH);
  console.log('Sheets:', wb.SheetNames.join(', '), '\n');

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

    const gradeNum = parseInt(sheetName.replace('Grade ', ''));
    console.log(`\n--- ${sheetName} ---`);

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as (any[] | null)[];

    let currentSubject: string | null = null;
    let currentIsAfrikaansSection = false;
    let publisherCols = new Map<number, string>();
    let sectionInserted = 0;

    for (const row of rows) {
      if (!row) continue;

      const col0 = row[0] != null ? String(row[0]).trim() : '';
      const col1 = row[1] != null ? String(row[1]).trim() : '';

      // ── Section heading: "Grade X - Subject" ──
      if (/^Grade\s+\d+/i.test(col0) && !col1) {
        // Log previous section stats
        if (currentSubject && sectionInserted > 0) {
          console.log(`  [${currentSubject}] ${sectionInserted} submodules inserted`);
        }
        const parsed = parseSectionHeading(col0);
        if (parsed) {
          currentSubject = parsed.subject;
          currentIsAfrikaansSection = isSectionAfrikaans(parsed.subject);
          sectionInserted = 0;
          publisherCols = new Map();
        }
        continue;
      }

      // ── Column header row: "Term | LAP Topic | ..." ──
      if (col0 === 'Term' && col1 === 'LAP Topic') {
        publisherCols = new Map();
        for (let i = 3; i < row.length; i++) {
          const h = row[i] != null ? String(row[i]).trim() : '';
          if (h) publisherCols.set(i, h);
        }
        continue;
      }

      // ── Term separator: "Term X" with no topic ──
      if (/^Term\s+\d+$/i.test(col0) && !col1) continue;

      // ── Data row: "Term X" with topic name ──
      if (!/^Term\s+\d+/i.test(col0) || !col1) continue;

      const termNum = parseInt(col0.replace(/^Term\s+/i, '')) || 1;
      const topicName = col1;
      const subTopicsRaw = row[2] != null ? String(row[2]) : '';

      if (!currentSubject) continue;

      // ── Language detection ──
      // Use per-row text detection for ALL grades, with section heading as fallback
      const isAfrikaans =
        currentIsAfrikaansSection || isAfrikaansText(topicName, subTopicsRaw);

      if (!isAfrikaans) continue;

      const subjectId = await getOrCreateSubject(currentSubject, subjectCache);

      // Each bullet point becomes a separate systemTopic row
      const submodules = parseSubTopics(subTopicsRaw);
      const modules = submodules.length > 0 ? submodules : [topicName];

      for (const submoduleName of modules) {
        const submoduleId = stableId(`${gradeNum}|${currentSubject}|${submoduleName}`);

        try {
          const result = await db
            .insert(systemTopics)
            .values({
              language: 'Afrikaans',
              grade: gradeNum,
              subjectId,
              term: termNum,
              topicName,
              submoduleName,
              submoduleId,
            })
            .onConflictDoNothing()
            .returning({ id: systemTopics.id });

          if (result.length > 0) {
            totalInserted++;
            sectionInserted++;
            const topicId = result[0].id;

            // Insert publisher mappings from any non-empty publisher columns
            for (const [colIdx, publisherName] of publisherCols) {
              const cellValue = row[colIdx];
              if (!cellValue || !String(cellValue).trim()) continue;
              const pubId = await getOrCreatePublisher(publisherName, publisherCache);
              await db
                .insert(textbookMappings)
                .values({
                  systemTopicId: topicId,
                  publisherId: pubId,
                  textbookTopicName: String(cellValue).trim(),
                })
                .onConflictDoNothing();
              totalMappings++;
            }
          } else {
            totalSkipped++;
          }
        } catch (e: any) {
          console.error(`  Error (${topicName} / ${submoduleName}): ${e.message?.slice(0, 120)}`);
          totalErrors++;
        }
      }
    }

    // Log last section
    if (currentSubject && sectionInserted > 0) {
      console.log(`  [${currentSubject}] ${sectionInserted} submodules inserted`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Submodules inserted : ${totalInserted}`);
  console.log(`Duplicates skipped  : ${totalSkipped}`);
  console.log(`Mappings inserted   : ${totalMappings}`);
  console.log(`Errors              : ${totalErrors}`);
  console.log('\nDone! Topics are now visible at /topics?language=Afrikaans');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

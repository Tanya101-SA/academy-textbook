/**
 * Import Afrikaans textbook indexes as textbook_mappings
 *
 * Scans BOTH "Indexes (Afrikaans Textbooks)" and "Indexes (English Textbooks)"
 * for index.txt files matching the 20 Afrikaans system topic subjects.
 * Matches index entries against Afrikaans system topics using word similarity.
 *
 * INSERT-ONLY — does NOT delete any existing data.
 *
 * Usage:  npx tsx scripts/import-afrikaans-indexes.ts
 */

import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings, missingTextbookTopics } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const BASE_PATH =
  'C:/Users/NicolaCrous/OneDrive - Speccon Holdings (Pty) Ltd/SpecCon Academy - Textbooks';

const AF_INDEX_ROOT = path.join(BASE_PATH, 'Indexes (Afrikaans Textbooks)');
const EN_INDEX_ROOT = path.join(BASE_PATH, 'Indexes (English Textbooks)');

// ─── Folder name → DB subject name mapping ──────────────────────────────────

const FOLDER_TO_DB_SUBJECT: Record<string, string | string[]> = {
  // Afrikaans Textbooks directory folder names
  'afrikaans huistaal': 'Afrikaans Huistaal',
  'besigheidstudies': 'Besigheidstudies',
  'ekonomie': 'Ekonomie',
  'ekonomiese en bestuurswetenskappe': 'Ekonomiese Bestuurswetenskappe',
  'fisiese wetenskappe': 'Fisiese Wetenskap',
  'geografie': 'Geografie',
  'geskiedenis': 'Geskiedenis',
  'lewensorientering': 'Lewensoriëntering',
  'lewensvaardighede': 'Lewensoriëntering',
  'lewenswetenskappe': 'Lewenswetenskappe',
  'natuurwetenskappe en tegnologie': 'Natuurwetenskap',
  'natuurwetenskappe': 'Natuurwetenskap',
  'rekeningkunde': 'Rekeningkunde',
  'skeppende kunste': 'Skeppende Kunste',
  'sosiale wetenskappe': ['Sosiale Wetenskap (Geografie)', 'Sosiale Wetenskap (Geskiedenis)'],
  'tegnologie': 'Tegnologie',
  'visuele kunste': 'Visuele Kunste',
  'wiskunde': 'Wiskunde',
  'wiskundige geletterdheid': 'Wiskunde Geletterdheid',
  // English Textbooks directory folder names (Afrikaans-side subjects)
  'english first additional language': 'English First Additional Language',
  'afrikaans eerste addisionele taal': 'English First Additional Language',
};

// Subjects from English Textbooks dir that should be included for Afrikaans matching
const EN_DIR_AFRIKAANS_SUBJECTS = new Set([
  'english first additional language',
  'afrikaans huistaal',
  'afrikaans eerste addisionele taal',
]);

// ─── Similarity matching ────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getWords(s: string): string[] {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'is', 'on', 'at', 'by',
    'with', 'from', 'as', 'it', 'its', 'are', 'was', 'be', 'has', 'have', 'had', 'not',
    'die', 'en', 'van', 'vir', 'met', 'op', 'uit', 'tot', 'wat', 'dat', 'nie', 'ook',
    'kan', 'sal', 'het', 'oor', 'na', 'om', 'een', 'twee', 'drie',
  ]);
  return normalize(s).split(' ').filter(w => w.length > 1 && !stop.has(w));
}

function similarity(a: string, b: string): number {
  const wa = new Set(getWords(a));
  const wb = new Set(getWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.size, wb.size);
}

// ─── Parse index.txt ────────────────────────────────────────────────────────

interface IndexEntry { topic: string; subTopic: string | null; }

function parseIndex(filePath: string): IndexEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''));
  const entries: IndexEntry[] = [];
  let currentTopic: string | null = null;

  const skipPatterns = [
    /^={3,}/, /^─{3,}/, /^-{3,}/,
    /^INHOUDSOPGAWE/i, /^TABLE OF CONTENTS/i,
    /^ISBN:/i, /^Uitgewer:/i, /^Publisher:/i, /^Kurrikulum:/i, /^Curriculum:/i,
    /^Fase:/i, /^Nota:/i, /^Bron:/i, /^Source:/i, /^Series:/i, /^Subject:/i,
    /^KWARTAAL \d/i, /^TERM \d/i, /^Term \d/i,
    /^HERSIENING/i, /^REVISION/i, /^ANTWOORDE/i, /^ANSWERS/i,
    /^EKSAMEN/i, /^EXAM/i, /^OEFENEKSAMEN/i,
    /^Vraestel \d/i, /^Woordelys/i, /^Glossary/i, /^Glossed/i,
    /^Kennisbaan/i, /^Graad \d/i, /^Grade \d/i,
    /^Acknowledgement/i, /^Contents/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (skipPatterns.some(p => p.test(trimmed))) continue;
    if (/leerderboek/i.test(trimmed) || /learner/i.test(trimmed)) continue;
    if (/^(Verken|Via Afrika|Piekfyn|KomInPas|Platinum|Die Antwoord|Afrikaans sonder|Oxford|Spot On|Focus)\s/i.test(trimmed)) continue;
    if (/^Eksamenwenke/i.test(trimmed)) continue;
    if (/assessment exemplar/i.test(trimmed)) continue;

    // Onderwerp/Topic heading
    const onderwerpMatch = trimmed.match(/^(Onderwerp|Topic)\s+\d+[\.:–—\-]\s*(.*)/i);
    if (onderwerpMatch) {
      currentTopic = onderwerpMatch[2].trim() || trimmed;
      if (currentTopic.length < 3) currentTopic = trimmed;
      entries.push({ topic: currentTopic, subTopic: null });
      continue;
    }

    // Tema/Hoofstuk/Module/Chapter heading
    const topicMatch = trimmed.match(/^(Tema|Hoofstuk|Module|Chapter|Strand)\s+\d+[\.:–—\-]\s*(.*)/i);
    if (topicMatch) {
      currentTopic = topicMatch[2].trim() || trimmed;
      if (currentTopic.length < 3) currentTopic = trimmed;
      entries.push({ topic: currentTopic, subTopic: null });
      continue;
    }

    // Geography/History Topic heading (for Platinum Social Sciences)
    const geoHistMatch = trimmed.match(/^(Geography|History|GEOGRAPHY|HISTORY)\s+Topic\s+\d+[\.:–—\-]?\s*(.*)/i);
    if (geoHistMatch) {
      currentTopic = geoHistMatch[2].trim() || trimmed;
      if (currentTopic.length < 3) currentTopic = trimmed;
      entries.push({ topic: currentTopic, subTopic: null });
      continue;
    }

    // Eenheid/Unit sub-topic
    const eenheidMatch = trimmed.match(/^(Eenheid|Unit)\s+[\d.]+[\.:–—\-]\s*(.*)/i);
    if (eenheidMatch && currentTopic) {
      const sub = eenheidMatch[2].trim() || trimmed;
      entries.push({ topic: currentTopic, subTopic: sub.length >= 3 ? sub : trimmed });
      continue;
    }

    // Numbered sub-items (1.1, 2.3, etc.)
    if (/^\d+\.\d+/.test(trimmed) && currentTopic) {
      const sub = trimmed.replace(/^\d+\.\d+\s*/, '').trim();
      entries.push({ topic: currentTopic, subTopic: sub.length >= 3 ? sub : trimmed });
      continue;
    }

    // Indented = sub-topic, non-indented = new topic
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    const isIndented = leadingSpaces >= 4 || line.startsWith('\t');

    if (isIndented && currentTopic) {
      if (trimmed.length > 2 && !skipPatterns.some(p => p.test(trimmed))) {
        entries.push({ topic: currentTopic, subTopic: trimmed });
      }
    } else if (!isIndented && trimmed.length > 2) {
      let topicName = trimmed.replace(/^(Unit|Chapter|Section|Part)\s+[\d.]+[\.:–—\-]\s*/i, '');
      if (topicName.length < 3) topicName = trimmed;
      if (!skipPatterns.some(p => p.test(topicName))) {
        currentTopic = topicName;
        entries.push({ topic: currentTopic, subTopic: null });
      }
    }
  }

  return entries;
}

// ─── Find index files ───────────────────────────────────────────────────────

interface IndexFile {
  publisher: string;
  subject: string;
  grade: number;
  filePath: string;
  sourceDir: 'afrikaans' | 'english';
}

function findIndexFiles(root: string, sourceDir: 'afrikaans' | 'english'): IndexFile[] {
  const results: IndexFile[] = [];

  if (!fs.existsSync(root)) {
    console.log(`Directory not found: ${root}`);
    return results;
  }

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.txt') {
        const rel = path.relative(root, full).replace(/\\/g, '/');
        const parts = rel.split('/');
        if (parts.length >= 3) {
          const publisher = parts[0];
          const subject = parts[1];
          const gradeFolder = parts[parts.length - 2];
          const gradeMatch = gradeFolder.match(/(\d+)(?:-(\d+))?/);
          if (gradeMatch) {
            if (gradeMatch[2]) {
              const start = parseInt(gradeMatch[1]);
              const end = parseInt(gradeMatch[2]);
              for (let g = start; g <= end; g++) {
                results.push({ publisher, subject, grade: g, filePath: full, sourceDir });
              }
            } else {
              results.push({ publisher, subject, grade: parseInt(gradeMatch[1]), filePath: full, sourceDir });
            }
          }
        }
      }
    }
  }
  walk(root);
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Import Afrikaans Textbook Indexes (INSERT-only) ===\n');

  // Load all subjects
  const allSubjects = await db.select().from(subjects);
  const subjectNameToId = new Map<string, number>();
  for (const s of allSubjects) {
    subjectNameToId.set(s.name.toLowerCase(), s.id);
    subjectNameToId.set(s.name, s.id);
  }
  console.log(`Loaded ${allSubjects.length} subjects`);

  // Load Afrikaans system topics
  const afTopics = await db
    .select({
      id: systemTopics.id,
      grade: systemTopics.grade,
      subjectId: systemTopics.subjectId,
      term: systemTopics.term,
      topicName: systemTopics.topicName,
      submoduleName: systemTopics.submoduleName,
    })
    .from(systemTopics)
    .where(eq(systemTopics.language, 'Afrikaans'));
  console.log(`Loaded ${afTopics.length} Afrikaans system topics`);

  // Reverse map: subjectId -> subject name
  const subjectIdToName = new Map<number, string>();
  for (const s of allSubjects) subjectIdToName.set(s.id, s.name);

  // Group topics by subjectName|grade
  const topicsByKey = new Map<string, typeof afTopics>();
  for (const t of afTopics) {
    const subName = subjectIdToName.get(t.subjectId) || '';
    const key = `${subName}|${t.grade}`;
    if (!topicsByKey.has(key)) topicsByKey.set(key, []);
    topicsByKey.get(key)!.push(t);
  }

  // Find all index files
  const afIndexFiles = findIndexFiles(AF_INDEX_ROOT, 'afrikaans');
  const enIndexFiles = findIndexFiles(EN_INDEX_ROOT, 'english');

  // Filter English index files to only include Afrikaans-side subjects
  const relevantEnFiles = enIndexFiles.filter(f =>
    EN_DIR_AFRIKAANS_SUBJECTS.has(f.subject.toLowerCase())
  );

  const allIndexFiles = [...afIndexFiles, ...relevantEnFiles];
  console.log(`Found ${afIndexFiles.length} Afrikaans index entries + ${relevantEnFiles.length} relevant English index entries = ${allIndexFiles.length} total\n`);

  // Publisher cache
  const publisherCache = new Map<string, number>();
  async function getOrCreatePublisher(name: string): Promise<number> {
    if (publisherCache.has(name)) return publisherCache.get(name)!;
    const existing = await db.select().from(publishers).where(eq(publishers.name, name)).limit(1);
    if (existing.length > 0) {
      publisherCache.set(name, existing[0].id);
      return existing[0].id;
    }
    const [ins] = await db.insert(publishers).values({ name }).returning({ id: publishers.id });
    publisherCache.set(name, ins.id);
    console.log(`  Created publisher: "${name}"`);
    return ins.id;
  }

  let totalEntries = 0;
  let totalMapped = 0;
  let totalUnmatched = 0;
  let totalSkippedFiles = 0;

  for (const indexFile of allIndexFiles) {
    const entries = parseIndex(indexFile.filePath);
    if (entries.length === 0) {
      console.log(`  SKIP (empty): ${indexFile.publisher}/${indexFile.subject} Gr ${indexFile.grade} [${indexFile.sourceDir}]`);
      totalSkippedFiles++;
      continue;
    }

    // Resolve folder subject name to DB subject name(s)
    const folderKey = indexFile.subject.toLowerCase();
    const dbSubjectNames = FOLDER_TO_DB_SUBJECT[folderKey];

    if (!dbSubjectNames) {
      console.log(`  SKIP (no subject mapping): "${indexFile.subject}" [${indexFile.publisher} Gr ${indexFile.grade}]`);
      totalSkippedFiles++;
      continue;
    }

    // Collect system topics for all matching subjects at this grade
    const subjectNamesList = Array.isArray(dbSubjectNames) ? dbSubjectNames : [dbSubjectNames];
    let sysTopics: typeof afTopics = [];
    let resolvedSubjectId: number | null = null;

    for (const dbSubName of subjectNamesList) {
      const key = `${dbSubName}|${indexFile.grade}`;
      const topics = topicsByKey.get(key);
      if (topics) {
        sysTopics = sysTopics.concat(topics);
        if (!resolvedSubjectId) {
          resolvedSubjectId = subjectNameToId.get(dbSubName) || null;
        }
      }
    }

    if (sysTopics.length === 0) {
      console.log(`  SKIP (no topics for grade): ${indexFile.publisher}/${indexFile.subject} Gr ${indexFile.grade} -> ${subjectNamesList.join(', ')}`);
      totalSkippedFiles++;
      continue;
    }

    const publisherId = await getOrCreatePublisher(indexFile.publisher);

    let mapped = 0;
    let unmatched = 0;

    for (const entry of entries) {
      const textbookTopicName = entry.subTopic
        ? `${entry.topic} - ${entry.subTopic}`
        : entry.topic;
      const searchText = entry.subTopic || entry.topic;

      let bestMatch: (typeof afTopics)[number] | null = null;
      let bestScore = 0;

      for (const st of sysTopics) {
        const s1 = similarity(searchText, st.submoduleName);
        const s2 = similarity(searchText, st.topicName);
        const s3 = entry.subTopic ? similarity(entry.topic, st.topicName) : 0;
        const combined = entry.subTopic ? `${entry.topic} ${entry.subTopic}` : entry.topic;
        const s4 = similarity(combined, `${st.topicName} ${st.submoduleName}`);
        const score = Math.max(s1, s2, s3, s4);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = st;
        }
      }

      if (bestMatch && bestScore >= 0.7) {
        try {
          await db
            .insert(textbookMappings)
            .values({
              systemTopicId: bestMatch.id,
              publisherId,
              textbookTopic: entry.topic,
              textbookTopicName,
              notes: `AF auto-matched (${(bestScore * 100).toFixed(0)}% similarity)`,
              createdBy: 'import-script',
            })
            .onConflictDoNothing();
          mapped++;
        } catch (e: any) {
          // Skip errors silently (likely duplicates)
        }
      } else if (resolvedSubjectId) {
        try {
          await db
            .insert(missingTextbookTopics)
            .values({
              publisherId,
              grade: indexFile.grade,
              subjectId: resolvedSubjectId,
              term: 1,
              topic: entry.topic,
              subTopic: entry.subTopic,
            })
            .onConflictDoNothing();
          unmatched++;
        } catch (e: any) {
          // Skip errors
        }
      } else {
        unmatched++;
      }
    }

    totalEntries += entries.length;
    totalMapped += mapped;
    totalUnmatched += unmatched;

    const matchRate = entries.length > 0 ? ((mapped / entries.length) * 100).toFixed(0) : '0';
    console.log(`  ${indexFile.publisher} / ${indexFile.subject} Gr ${indexFile.grade}: ${entries.length} entries, ${mapped} mapped (${matchRate}%) [${indexFile.sourceDir}]`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total index entries : ${totalEntries}`);
  console.log(`Mapped to topics   : ${totalMapped}`);
  console.log(`Unmatched          : ${totalUnmatched}`);
  console.log(`Skipped files      : ${totalSkippedFiles}`);
  console.log(`Match rate         : ${totalEntries > 0 ? ((totalMapped / totalEntries) * 100).toFixed(1) : 0}%`);
  console.log('\nDone! Mappings visible at /topics?language=Afrikaans');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

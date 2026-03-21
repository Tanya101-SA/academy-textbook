/**
 * Import The Answer Series (TAS) textbook topics into the textbook-mapping PostgreSQL database.
 *
 * Usage: npx tsx scripts/import-tas.ts
 */

import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings, missingTextbookTopics } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const TAS_INDEX_ROOT = "C:/Users/tanya/Speccon Holdings (Pty) Ltd/SpecCon Academy - Documents/Textbooks/Indexes (English Textbooks)/The Answer Series";

// ─── Word similarity ───
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function getWords(s: string): string[] {
  const stop = new Set(["the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "on", "at", "by", "with", "from", "as", "it", "its", "are", "was", "be", "has", "have", "had", "not", "but", "if", "do", "no", "so", "up", "out", "all"]);
  return normalize(s).split(" ").filter(w => w.length > 1 && !stop.has(w));
}

function similarity(a: string, b: string): number {
  const wa = new Set(getWords(a));
  const wb = new Set(getWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.size, wb.size);
}

// ─── Parse index.txt ───
interface IndexEntry { topic: string; subTopic: string | null; }

function parseIndex(filePath: string): IndexEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.replace(/\r$/, ""));
  const entries: IndexEntry[] = [];
  let currentTopic: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const isSubTopic = line.startsWith("    ") || line.startsWith("\t");
    if (isSubTopic && currentTopic) {
      entries.push({ topic: currentTopic, subTopic: line.trim() });
    } else {
      let topicName = line.trim().replace(/^(Unit|Chapter|Module|Section|Part)\s+\d+[\.:]\s*/i, "");
      if (topicName) {
        currentTopic = topicName;
        entries.push({ topic: currentTopic, subTopic: null });
      }
    }
  }
  return entries;
}

// ─── Find TAS index files ───
interface IndexFile { subject: string; grade: number; filePath: string; }

function findIndexFiles(root: string): IndexFile[] {
  const results: IndexFile[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.txt") {
        const rel = path.relative(root, full).replace(/\\/g, "/");
        const parts = rel.split("/");
        if (parts.length >= 3) {
          const subject = parts[0];
          const gradeMatch = parts[1].match(/(\d+)/);
          if (gradeMatch) {
            results.push({ subject, grade: parseInt(gradeMatch[1]), filePath: full });
          }
        }
      }
    }
  }
  walk(root);
  return results;
}

// Subject name mapping (TAS folder names -> DB subject names)
const subjectAliases: Record<string, string> = {
  "accounting": "accounting",
  "agricultural sciences": "agricultural sciences",
  "business studies": "business studies",
  "consumer studies": "consumer studies",
  "ems": "economic and management sciences",
  "economics": "economics",
  "english fal": "english first additional language",
  "english hl": "english home language",
  "geography": "geography",
  "history": "history",
  "life sciences": "life sciences",
  "mathematical literacy": "mathematical literacy",
  "mathematics": "mathematics",
  "natural sciences": "natural sciences",
  "physical sciences": "physical sciences",
};

async function main() {
  console.log("=== Importing The Answer Series into textbook-mapping DB ===\n");

  // 1. Ensure publisher exists
  const existingPubs = await db.select().from(publishers).where(eq(publishers.name, "The Answer Series"));
  let publisherId: number;
  if (existingPubs.length === 0) {
    const [ins] = await db.insert(publishers).values({ name: "The Answer Series" }).returning({ id: publishers.id });
    publisherId = ins.id;
    console.log(`Created publisher "The Answer Series" (id=${publisherId})`);
  } else {
    publisherId = existingPubs[0].id;
    console.log(`Publisher "The Answer Series" already exists (id=${publisherId})`);
  }

  // 2. Load subjects
  const allSubjects = await db.select().from(subjects);
  const subjectsMap: Record<string, number> = {};
  for (const s of allSubjects) {
    subjectsMap[s.name.toLowerCase()] = s.id;
  }
  console.log(`Loaded ${allSubjects.length} subjects`);

  // 3. Load English system topics
  const allTopics = await db
    .select({
      id: systemTopics.id,
      grade: systemTopics.grade,
      subjectId: systemTopics.subjectId,
      term: systemTopics.term,
      topicName: systemTopics.topicName,
      submoduleName: systemTopics.submoduleName,
    })
    .from(systemTopics)
    .where(eq(systemTopics.language, "English"));
  console.log(`Loaded ${allTopics.length} English system topics`);

  // Group by subject+grade
  const topicsByKey: Record<string, typeof allTopics> = {};
  // Need reverse map: subjectId -> name
  const subjectIdToName: Record<number, string> = {};
  for (const s of allSubjects) subjectIdToName[s.id] = s.name.toLowerCase();

  for (const t of allTopics) {
    const subName = subjectIdToName[t.subjectId] || "";
    const key = `${subName}|${t.grade}`;
    if (!topicsByKey[key]) topicsByKey[key] = [];
    topicsByKey[key].push(t);
  }

  // 4. Clear existing TAS data
  await db.delete(textbookMappings).where(eq(textbookMappings.publisherId, publisherId));
  await db.delete(missingTextbookTopics).where(eq(missingTextbookTopics.publisherId, publisherId));
  console.log("Cleared any existing TAS mappings\n");

  // 5. Process all index files
  const indexFiles = findIndexFiles(TAS_INDEX_ROOT);
  console.log(`Found ${indexFiles.length} TAS index files\n`);

  let totalEntries = 0;
  let totalMapped = 0;
  let totalUnmatched = 0;

  for (const indexFile of indexFiles) {
    const subjectKey = indexFile.subject.toLowerCase();
    const dbSubjectName = subjectAliases[subjectKey] || subjectKey;
    const subjectId = subjectsMap[dbSubjectName];

    if (!subjectId) {
      // Try fuzzy match
      let foundId: number | null = null;
      let foundName = "";
      for (const [name, id] of Object.entries(subjectsMap)) {
        if (similarity(dbSubjectName, name) >= 0.7) {
          foundId = id;
          foundName = name;
          break;
        }
      }
      if (!foundId) {
        console.log(`  SKIP: No matching subject for "${indexFile.subject}" (Grade ${indexFile.grade})`);
        continue;
      }
      console.log(`  Fuzzy matched subject "${indexFile.subject}" -> "${foundName}"`);
      const entries = parseIndex(indexFile.filePath);
      totalEntries += entries.length;
      const r = await processEntries(entries, foundId, foundName, indexFile.grade, publisherId, topicsByKey);
      totalMapped += r.mapped;
      totalUnmatched += r.unmatched;
      console.log(`  ${indexFile.subject} Grade ${indexFile.grade}: ${entries.length} entries, ${r.mapped} mapped, ${r.unmatched} unmatched`);
      continue;
    }

    const entries = parseIndex(indexFile.filePath);
    totalEntries += entries.length;
    const r = await processEntries(entries, subjectId, dbSubjectName, indexFile.grade, publisherId, topicsByKey);
    totalMapped += r.mapped;
    totalUnmatched += r.unmatched;
    console.log(`  ${indexFile.subject} Grade ${indexFile.grade}: ${entries.length} entries, ${r.mapped} mapped, ${r.unmatched} unmatched`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total entries: ${totalEntries}`);
  console.log(`Mapped: ${totalMapped}`);
  console.log(`Unmatched: ${totalUnmatched}`);
  console.log(`Match rate: ${totalEntries > 0 ? ((totalMapped / totalEntries) * 100).toFixed(1) : 0}%`);
  console.log("Done!");
}

async function processEntries(
  entries: IndexEntry[],
  subjectId: number,
  subjectName: string,
  grade: number,
  publisherId: number,
  topicsByKey: Record<string, any[]>
) {
  const key = `${subjectName}|${grade}`;
  const sysTopics = topicsByKey[key] || [];
  let mapped = 0;
  let unmatched = 0;

  for (const entry of entries) {
    const textbookTopicName = entry.subTopic
      ? `${entry.topic} - ${entry.subTopic}`
      : entry.topic;
    const searchText = entry.subTopic || entry.topic;

    let bestMatch: any = null;
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
      await db.insert(textbookMappings).values({
        systemTopicId: bestMatch.id,
        publisherId,
        textbookTopic: entry.topic,
        textbookTopicName,
        notes: `Auto-matched (${(bestScore * 100).toFixed(0)}% similarity)`,
      });
      mapped++;
    } else {
      await db.insert(missingTextbookTopics).values({
        publisherId,
        grade,
        subjectId,
        term: 1,
        topic: entry.topic,
        subTopic: entry.subTopic,
      });
      unmatched++;
    }
  }

  return { mapped, unmatched };
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

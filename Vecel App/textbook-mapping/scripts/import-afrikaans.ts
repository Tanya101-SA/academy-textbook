/**
 * ⚠️  DISABLED — DO NOT RUN THIS SCRIPT ⚠️
 *
 * This script deletes ALL textbook_mappings per publisher before re-importing,
 * which destroys manual corrections made by publishers via the web app.
 * Use import-v2-afrikaans.ts instead (INSERT-only, no destructive operations).
 *
 * Original description:
 * Import ALL Afrikaans textbook indexes into the textbook-mapping PostgreSQL database.
 *
 * For each Afrikaans publisher, creates a publisher record (or reuses existing),
 * then imports topics matched against English system topics using bilingual matching.
 *
 * Usage: npx tsx scripts/import-afrikaans.ts
 */

console.error('❌ This script is DISABLED. It deletes all textbook mappings per publisher, destroying manual corrections.');
console.error('   Use: npx tsx scripts/import-v2-afrikaans.ts instead.');
process.exit(1);

import { db } from '../src/db/index.js';
import { subjects, systemTopics, publishers, textbookMappings, missingTextbookTopics } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const AF_INDEX_ROOT =
  "C:/Users/tanya/Speccon Holdings (Pty) Ltd/SpecCon Academy - Documents/Textbooks/Indexes (Afrikaans Textbooks)";

// ─── Afrikaans → English subject mapping (must match PG subjects table exactly) ───
const subjectMap: Record<string, string> = {
  "lewenswetenskappe": "life science",
  "fisiese wetenskappe": "physical science",
  "wiskunde": "mathematics",
  "rekeningkunde": "accounting",
  "afrikaans eerste addisionele taal": "afrikaans eerste addisionele taal",
  "afrikaans huistaal": "english home language", // No AF HL in PG — map to closest
  "besigheidstudies": "business studies",
  "ekonomie": "economics",
  "ekonomiese en bestuurswetenskappe": "economic management sciences",
  "geografie": "geography",
  "geskiedenis": "history",
  "lewensorientering": "life orientation",
  "lewensvaardighede": "life orientation", // No Life Skills in PG — closest match
  "wiskundige geletterdheid": "mathematics literacy",
  "sosiale wetenskappe": "social science (geography)",
  "natuurwetenskappe": "natural science",
  "natuurwetenskappe en tegnologie": "natural science",
  "tegnologie": "technology",
  "skeppende kunste": "creative arts",
};

// ─── Bilingual translation terms ───
const bilingualTerms: Record<string, string> = {
  "biodiversiteit": "biodiversity", "fotosintese": "photosynthesis",
  "respirasie": "respiration", "selbiologie": "cell biology",
  "voortplanting": "reproduction", "genetika": "genetics",
  "oorerwing": "inheritance", "evolusie": "evolution",
  "ekologie": "ecology", "ekosisteme": "ecosystems",
  "organiese": "organic", "gewerweldes": "vertebrates",
  "gasuitruiling": "gas exchange", "bloedsomloop": "circulation",
  "senustelsel": "nervous system", "endokriene stelsel": "endocrine system",
  "homeostase": "homeostasis", "meiose": "meiosis", "mitose": "mitosis",
  "dns": "dna", "litosfeer": "lithosphere", "hidrosfeer": "hydrosphere",
  "atmosfeer": "atmosphere", "biosfeer": "biosphere",
  "klasifikasie": "classification", "meganika": "mechanics",
  "elektrisiteit": "electricity", "magnetisme": "magnetism",
  "elektrostatika": "electrostatics", "elektrodinamika": "electrodynamics",
  "elektromagnetisme": "electromagnetism", "golwe": "waves",
  "klank": "sound", "lig": "light", "optika": "optics",
  "momentum": "momentum", "impuls": "impulse", "kragte": "forces",
  "beweging": "motion", "energie": "energy", "arbeid": "work",
  "drywing": "power", "gravitasie": "gravity", "atoom": "atom",
  "periodieke tabel": "periodic table", "chemiese binding": "chemical bonding",
  "chemiese verandering": "chemical change", "chemiese ewewig": "chemical equilibrium",
  "sure": "acids", "basisse": "bases", "stoïgiometrie": "stoichiometry",
  "elektrochemiese": "electrochemical", "organiese chemie": "organic chemistry",
  "dopplereffek": "doppler effect", "stroombane": "circuits",
  "vektore": "vectors", "skalare": "scalars", "projektielbeweging": "projectile motion",
  "ideale gasse": "ideal gases", "algebra": "algebra",
  "meetkunde": "geometry", "trigonometrie": "trigonometry",
  "statistiek": "statistics", "waarskynlikheid": "probability",
  "funksies": "functions", "grafieke": "graphs", "vergelykings": "equations",
  "ongelykhede": "inequalities", "reekse": "sequences", "rye": "series",
  "differensiaalrekening": "differential calculus", "eksponente": "exponents",
  "logaritmes": "logarithms", "sirkelgeometrie": "circle geometry",
  "analitiese meetkunde": "analytical geometry",
  "finansiële wiskunde": "financial mathematics",
  "permutasies": "permutations", "kombinasies": "combinations",
  "begrotings": "budgets", "kontantvloeistaat": "cash flow statement",
  "inkomstestaat": "income statement", "finansiële state": "financial statements",
  "waardevermindering": "depreciation", "voorraad": "inventory",
  "debiteure": "debtors", "krediteure": "creditors",
  "bankrekonsilasie": "bank reconciliation", "vennootskap": "partnership",
  "maatskappy": "company", "bates": "assets", "etiek": "ethics",
  "belasting": "tax", "btw": "vat", "joernale": "journals", "grootboek": "ledger",
};

// ─── Similarity functions ───
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function translateAfToEn(text: string): string {
  let result = text.toLowerCase();
  const sorted = Object.entries(bilingualTerms).sort((a, b) => b[0].length - a[0].length);
  for (const [af, en] of sorted) {
    result = result.replace(new RegExp(af.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), en);
  }
  return result;
}

function getWords(s: string): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "on", "at", "by",
    "with", "from", "as", "it", "its", "are", "was", "be", "has", "have", "had", "not",
    "die", "en", "van", "vir", "met", "op", "uit", "tot", "wat", "dat", "nie", "ook",
    "kan", "sal", "het", "oor", "na", "om",
  ]);
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

function bilingualSimilarity(afText: string, enText: string): number {
  const direct = similarity(afText, enText);
  const translated = translateAfToEn(afText);
  const translatedSim = similarity(translated, enText);
  return Math.max(direct, translatedSim);
}

// ─── Parse index.txt ───
interface IndexEntry { topic: string; subTopic: string | null; }

function parseIndex(filePath: string): IndexEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.replace(/\r$/, ""));
  const entries: IndexEntry[] = [];
  let currentTopic: string | null = null;

  const skipPatterns = [
    /^={3,}/, /^─{3,}/, /^-{3,}/,
    /^INHOUDSOPGAWE/i, /^TABLE OF CONTENTS/i,
    /^ISBN:/i, /^Uitgewer:/i, /^Kurrikulum:/i, /^Fase:/i, /^Nota:/i, /^Bron:/i,
    /^KWARTAAL \d/i, /^TERM \d/i,
    /^HERSIENING EN EKSAMEN/i, /^HERSIENING EN EKSAMENVOORBEREIDING/i,
    /^ANTWOORDE OP VRAE/i, /^EKSAMENVRAESTELLE/i, /^OEFENEKSAMENVRAESTELLE/i,
    /^Vraestel \d/i, /^Woordelys/i, /^Kennisbaan:/i, /^Graad \d/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (skipPatterns.some(p => p.test(trimmed))) continue;
    if (/leerderboek/i.test(trimmed) || /learner/i.test(trimmed)) continue;
    if (/^Verken\s/i.test(trimmed) || /^Via Afrika\s/i.test(trimmed)) continue;
    if (/^Eksamenwenke/i.test(trimmed)) continue;
    if (/^Die Antwoord/i.test(trimmed)) continue;
    if (/^Afrikaans sonder/i.test(trimmed)) continue;

    // Onderwerp = topic
    const onderwerpMatch = trimmed.match(/^Onderwerp\s+\d+[\.:–—-]\s*(.*)/i);
    if (onderwerpMatch) {
      currentTopic = onderwerpMatch[1].trim() || trimmed;
      if (currentTopic.length < 3) currentTopic = trimmed;
      entries.push({ topic: currentTopic, subTopic: null });
      continue;
    }

    // Tema/Hoofstuk = topic
    const topicMatch = trimmed.match(/^(Tema|Hoofstuk|Module)\s+\d+[\.:–—-]\s*(.*)/i);
    if (topicMatch) {
      currentTopic = topicMatch[2].trim() || trimmed;
      if (currentTopic.length < 3) currentTopic = trimmed;
      entries.push({ topic: currentTopic, subTopic: null });
      continue;
    }

    // Eenheid = sub-topic
    const eenheidMatch = trimmed.match(/^(Eenheid|Unit)\s+\d+[\.:–—-]\s*(.*)/i);
    if (eenheidMatch && currentTopic) {
      const sub = eenheidMatch[2].trim() || trimmed;
      entries.push({ topic: currentTopic, subTopic: sub.length >= 3 ? sub : trimmed });
      continue;
    }

    // Numbered sub-items
    if (/^\d+\.\d+/.test(trimmed) && currentTopic) {
      const sub = trimmed.replace(/^\d+\.\d+\s*/, "").trim();
      entries.push({ topic: currentTopic, subTopic: sub.length >= 3 ? sub : trimmed });
      continue;
    }

    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    const isIndented = leadingSpaces >= 4 || line.startsWith("\t");

    if (isIndented && currentTopic) {
      if (trimmed.length > 2 && !skipPatterns.some(p => p.test(trimmed))) {
        entries.push({ topic: currentTopic, subTopic: trimmed });
      }
    } else if (!isIndented && trimmed.length > 2) {
      let topicName = trimmed.replace(/^(Unit|Chapter|Section|Part)\s+\d+[\.:–—-]\s*/i, "");
      if (topicName.length < 3) topicName = trimmed;
      if (!skipPatterns.some(p => p.test(topicName))) {
        currentTopic = topicName;
        entries.push({ topic: currentTopic, subTopic: null });
      }
    }
  }

  return entries;
}

// ─── Find index files ───
interface IndexFile { publisher: string; subject: string; grade: number; filePath: string; }

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
          const publisher = parts[0];
          const subject = parts[1];
          const gradeFolder = parts[parts.length - 2];
          const gradeMatch = gradeFolder.match(/(\d+)(?:-(\d+))?/);
          if (gradeMatch) {
            if (gradeMatch[2]) {
              const start = parseInt(gradeMatch[1]);
              const end = parseInt(gradeMatch[2]);
              for (let g = start; g <= end; g++) {
                results.push({ publisher, subject, grade: g, filePath: full });
              }
            } else {
              results.push({ publisher, subject, grade: parseInt(gradeMatch[1]), filePath: full });
            }
          }
        }
      }
    }
  }
  walk(root);
  return results;
}

// ─── Main ───
async function main() {
  console.log("=== Importing Afrikaans Textbook Indexes into PostgreSQL (textbook-mapping) ===\n");

  // Load subjects
  const allSubjects = await db.select().from(subjects);
  const subjectsMap: Record<string, number> = {};
  for (const s of allSubjects) {
    subjectsMap[s.name.toLowerCase()] = s.id;
  }
  console.log(`Loaded ${allSubjects.length} subjects`);

  // Load English system topics
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

  // Reverse map: subjectId -> name
  const subjectIdToName: Record<number, string> = {};
  for (const s of allSubjects) subjectIdToName[s.id] = s.name.toLowerCase();

  // Group topics by subject+grade
  const topicsByKey: Record<string, typeof allTopics> = {};
  for (const t of allTopics) {
    const subName = subjectIdToName[t.subjectId] || "";
    const key = `${subName}|${t.grade}`;
    if (!topicsByKey[key]) topicsByKey[key] = [];
    topicsByKey[key].push(t);
  }

  // Find all Afrikaans index files
  const indexFiles = findIndexFiles(AF_INDEX_ROOT);
  console.log(`Found ${indexFiles.length} Afrikaans index file entries\n`);

  // Process publisher by publisher
  const publisherGroups: Record<string, IndexFile[]> = {};
  for (const f of indexFiles) {
    if (!publisherGroups[f.publisher]) publisherGroups[f.publisher] = [];
    publisherGroups[f.publisher].push(f);
  }

  let totalEntries = 0;
  let totalMapped = 0;
  let totalUnmatched = 0;

  for (const [pubName, files] of Object.entries(publisherGroups)) {
    // Ensure publisher exists
    const existingPubs = await db.select().from(publishers).where(eq(publishers.name, pubName));
    let publisherId: number;
    if (existingPubs.length === 0) {
      const [ins] = await db.insert(publishers).values({ name: pubName }).returning({ id: publishers.id });
      publisherId = ins.id;
      console.log(`Created publisher "${pubName}" (id=${publisherId})`);
    } else {
      publisherId = existingPubs[0].id;
      console.log(`Publisher "${pubName}" exists (id=${publisherId})`);
    }

    // Clear existing data for this publisher (Afrikaans data only — we tag notes)
    await db.delete(textbookMappings).where(
      and(eq(textbookMappings.publisherId, publisherId))
    );
    await db.delete(missingTextbookTopics).where(
      and(eq(missingTextbookTopics.publisherId, publisherId))
    );

    for (const indexFile of files) {
      const entries = parseIndex(indexFile.filePath);
      if (entries.length === 0) {
        console.log(`  SKIP: Empty ${pubName}/${indexFile.subject} Gr ${indexFile.grade}`);
        continue;
      }

      // Map Afrikaans subject to English
      const afSubjectKey = indexFile.subject.toLowerCase();
      const enSubjectName = subjectMap[afSubjectKey];
      const subjectId = enSubjectName ? subjectsMap[enSubjectName] : null;

      if (!subjectId) {
        // Try fuzzy match on subject name
        let foundId: number | null = null;
        let foundName = "";
        for (const [name, id] of Object.entries(subjectsMap)) {
          if (similarity(afSubjectKey, name) >= 0.6) {
            foundId = id;
            foundName = name;
            break;
          }
        }
        if (!foundId) {
          console.log(`  SKIP: No matching subject for "${indexFile.subject}" (Gr ${indexFile.grade})`);
          continue;
        }
        console.log(`  Fuzzy matched "${indexFile.subject}" -> "${foundName}"`);
      }

      const resolvedSubjectId = subjectId || 0;
      const resolvedSubjectName = enSubjectName || afSubjectKey;
      const key = `${resolvedSubjectName}|${indexFile.grade}`;
      const sysTopics = topicsByKey[key] || [];

      let mapped = 0;
      let unmatched = 0;

      for (const entry of entries) {
        const textbookTopicName = entry.subTopic
          ? `${entry.topic} - ${entry.subTopic}`
          : entry.topic;
        const searchText = entry.subTopic || entry.topic;

        let bestMatch: (typeof allTopics)[number] | null = null;
        let bestScore = 0;

        for (const st of sysTopics) {
          const s1 = bilingualSimilarity(searchText, st.submoduleName);
          const s2 = bilingualSimilarity(searchText, st.topicName);
          const s3 = entry.subTopic ? bilingualSimilarity(entry.topic, st.topicName) : 0;
          const combined = entry.subTopic ? `${entry.topic} ${entry.subTopic}` : entry.topic;
          const s4 = bilingualSimilarity(combined, `${st.topicName} ${st.submoduleName}`);
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
            notes: `AF auto-matched (${(bestScore * 100).toFixed(0)}% bilingual similarity)`,
          });
          mapped++;
        } else if (resolvedSubjectId > 0) {
          await db.insert(missingTextbookTopics).values({
            publisherId,
            grade: indexFile.grade,
            subjectId: resolvedSubjectId,
            term: 1,
            topic: entry.topic,
            subTopic: entry.subTopic,
          });
          unmatched++;
        }
      }

      totalEntries += entries.length;
      totalMapped += mapped;
      totalUnmatched += unmatched;

      const matchRate = entries.length > 0 ? ((mapped / entries.length) * 100).toFixed(0) : "0";
      console.log(`  ${pubName} / ${indexFile.subject} Gr ${indexFile.grade}: ${entries.length} entries, ${mapped} mapped (${matchRate}%)`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total entries: ${totalEntries}`);
  console.log(`Mapped: ${totalMapped}`);
  console.log(`Unmatched: ${totalUnmatched}`);
  console.log(`Match rate: ${totalEntries > 0 ? ((totalMapped / totalEntries) * 100).toFixed(1) : 0}%`);
  console.log("Done!");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

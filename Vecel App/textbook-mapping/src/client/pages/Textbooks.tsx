import { useState, useEffect, useMemo } from 'react';
import { authFetch } from '../hooks/useAuth';
import { parseIndex, normalizeForMatch, type IndexLine, type ParsedIndex } from '../lib/indexParser';

interface ManifestEntry {
  id: string;
  language: string;
  grade: number;
  subject: string;
  publisher: string;
  title: string;
  isbn?: string;
  curriculum?: string;
  indexPath: string;
}

interface Manifest {
  textbooks: ManifestEntry[];
}

interface MappingRow {
  id: number;
  language: string;
  grade: number;
  subjectName: string;
  term: number;
  topicName: string;
  submoduleName: string;
  submoduleId: number;
  mappingId: number | null;
  publisherId: number;
  publisherName: string;
  textbookTopic: string | null;
  textbookTopicName: string | null;
  notes: string | null;
  updatedAt: string | null;
}

type Language = 'English' | 'Afrikaans';

export default function Textbooks() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [language, setLanguage] = useState<Language>('English');
  const [grade, setGrade] = useState<number | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<ManifestEntry | null>(null);

  const [parsed, setParsed] = useState<ParsedIndex | null>(null);
  const [rows, setRows] = useState<MappingRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/textbook-indexes/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch((e) => setError(`Failed to load manifest: ${e.message}`));
  }, []);

  const booksInLanguage = useMemo(
    () => manifest?.textbooks.filter((b) => b.language === language) ?? [],
    [manifest, language],
  );
  const gradesAvailable = useMemo(
    () => Array.from(new Set(booksInLanguage.map((b) => b.grade))).sort((a, b) => a - b),
    [booksInLanguage],
  );
  const subjectsAvailable = useMemo(
    () =>
      grade == null
        ? []
        : Array.from(new Set(booksInLanguage.filter((b) => b.grade === grade).map((b) => b.subject))).sort(),
    [booksInLanguage, grade],
  );
  const booksForSubject = useMemo(
    () =>
      grade == null || subject == null
        ? []
        : booksInLanguage.filter((b) => b.grade === grade && b.subject === subject),
    [booksInLanguage, grade, subject],
  );

  useEffect(() => {
    if (!selectedBook) {
      setParsed(null);
      setRows(null);
      return;
    }
    setLoading(true);
    setError(null);

    const indexP = fetch(selectedBook.indexPath)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load index.txt (${r.status})`);
        return r.text();
      })
      .then((text) => parseIndex(text));

    const params = new URLSearchParams({
      language: selectedBook.language,
      grade: String(selectedBook.grade),
      subject: selectedBook.subject,
      publisher: selectedBook.publisher,
    });
    const mappingsP = authFetch(`/api/textbooks/mappings?${params}`).then(async (r) => {
      if (!r.ok) throw new Error(`Failed to load mappings (${r.status})`);
      return (await r.json()) as { topics: MappingRow[] };
    });

    Promise.all([indexP, mappingsP])
      .then(([p, m]) => {
        setParsed(p);
        setRows(m.topics);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBook]);

  const mappingLookup = useMemo(() => buildMappingLookup(rows ?? []), [rows]);

  function handleLanguage(l: Language) {
    setLanguage(l);
    setGrade(null);
    setSubject(null);
    setSelectedBook(null);
  }
  function handleGrade(g: number) {
    setGrade(g);
    setSubject(null);
    setSelectedBook(null);
  }
  function handleSubject(s: string) {
    setSubject(s);
    setSelectedBook(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Textbooks</h1>

      {/* Language tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['English', 'Afrikaans'] as Language[]).map((l) => (
          <button
            key={l}
            onClick={() => handleLanguage(l)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              language === l
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Drill-down buttons */}
      <div className="space-y-4 mb-6">
        <DrillSection label="Grade">
          {gradesAvailable.length === 0 ? (
            <span className="text-sm text-gray-400 italic">
              No {language} textbooks available yet.
            </span>
          ) : (
            gradesAvailable.map((g) => (
              <DrillButton key={g} active={grade === g} onClick={() => handleGrade(g)}>
                Grade {g}
              </DrillButton>
            ))
          )}
        </DrillSection>

        {grade != null && (
          <DrillSection label="Subject">
            {subjectsAvailable.map((s) => (
              <DrillButton key={s} active={subject === s} onClick={() => handleSubject(s)}>
                {s}
              </DrillButton>
            ))}
          </DrillSection>
        )}

        {grade != null && subject != null && (
          <DrillSection label="Textbook">
            {booksForSubject.map((b) => (
              <DrillButton
                key={b.id}
                active={selectedBook?.id === b.id}
                onClick={() => setSelectedBook(b)}
              >
                {b.publisher}
              </DrillButton>
            ))}
          </DrillSection>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {selectedBook && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {parsed?.header.title || selectedBook.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {parsed?.header.publisher && <span>Publisher: {parsed.header.publisher}</span>}
              {(parsed?.header.isbn || selectedBook.isbn) && (
                <span>ISBN: {parsed?.header.isbn || selectedBook.isbn}</span>
              )}
              {(parsed?.header.curriculum || selectedBook.curriculum) && (
                <span>Curriculum: {parsed?.header.curriculum || selectedBook.curriculum}</span>
              )}
              <span>Language: {selectedBook.language}</span>
              <span>Grade: {selectedBook.grade}</span>
              <span>Subject: {selectedBook.subject}</span>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-sm text-gray-500">Loading index…</div>
            ) : parsed ? (
              <IndexView lines={parsed.lines} lookup={mappingLookup} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function DrillSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function DrillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// ── Rendering the parsed index with mapping status ─────────────────────────

type MappingLookup = {
  byTermTopic: Map<string, MappingRow[]>; // key = `${term}|${normalizedTopicName}`
  byTerm: Map<number, MappingRow[]>;
  used: Set<number>; // submoduleId set (mutated during render)
  all: MappingRow[];
};

function buildMappingLookup(rows: MappingRow[]): MappingLookup {
  const byTermTopic = new Map<string, MappingRow[]>();
  const byTerm = new Map<number, MappingRow[]>();
  for (const r of rows) {
    const key = `${r.term}|${normalizeForMatch(r.topicName)}`;
    if (!byTermTopic.has(key)) byTermTopic.set(key, []);
    byTermTopic.get(key)!.push(r);
    if (!byTerm.has(r.term)) byTerm.set(r.term, []);
    byTerm.get(r.term)!.push(r);
  }
  return { byTermTopic, byTerm, used: new Set(), all: rows };
}

function findMatch(
  line: IndexLine,
  lookup: MappingLookup,
  currentTopicName: string | undefined,
): MappingRow | null {
  if (!line.mappable) return null;
  const needle = normalizeForMatch(line.title);
  if (!needle) return null;

  const candidateSets: MappingRow[][] = [];
  if (line.termNumber && currentTopicName) {
    const key = `${line.termNumber}|${normalizeForMatch(currentTopicName)}`;
    const c = lookup.byTermTopic.get(key);
    if (c) candidateSets.push(c);
  }
  if (line.termNumber) {
    const c = lookup.byTerm.get(line.termNumber);
    if (c) candidateSets.push(c);
  }
  candidateSets.push(lookup.all);

  for (const set of candidateSets) {
    const exact = set.find(
      (r) => !lookup.used.has(r.id) && normalizeForMatch(r.submoduleName) === needle,
    );
    if (exact) return exact;

    const contains = set.find((r) => {
      if (lookup.used.has(r.id)) return false;
      const hay = normalizeForMatch(r.submoduleName);
      return hay.includes(needle) || needle.includes(hay);
    });
    if (contains) return contains;
  }
  return null;
}

function IndexView({ lines, lookup }: { lines: IndexLine[]; lookup: MappingLookup }) {
  // Track matches in render pass — reset used set each render
  lookup.used.clear();

  let currentTopicName: string | undefined;

  return (
    <div className="font-mono text-sm leading-relaxed space-y-0.5">
      {lines.map((line, idx) => {
        if (line.kind === 'topic') currentTopicName = line.title;
        if (line.kind === 'term') currentTopicName = undefined;

        const match = findMatch(line, lookup, currentTopicName);
        if (match) lookup.used.add(match.id);

        return <IndexLineRow key={idx} line={line} match={match} />;
      })}
    </div>
  );
}

function IndexLineRow({ line, match }: { line: IndexLine; match: MappingRow | null }) {
  const paddingLeft = `${line.indent * 0.35}rem`;

  if (line.kind === 'term') {
    return (
      <div className="pt-4 pb-1" style={{ paddingLeft }}>
        <div className="text-base font-bold text-blue-800">
          Term {line.number} – {line.title}
        </div>
      </div>
    );
  }
  if (line.kind === 'topic') {
    return (
      <div className="pt-3 pb-1" style={{ paddingLeft }}>
        <div className="text-sm font-semibold text-gray-900">
          Topic {line.number}: {line.title}
        </div>
      </div>
    );
  }
  if (line.kind === 'topic-revision' || line.kind === 'term-test') {
    return (
      <div className="py-0.5 text-xs text-gray-500 italic" style={{ paddingLeft }}>
        {line.kind === 'term-test' ? `Term ${line.number} ${line.title}` : line.raw}
      </div>
    );
  }

  // Mappable leaf
  const label = formatLeafLabel(line);

  return (
    <div className="py-1.5 border-b border-gray-100 last:border-0" style={{ paddingLeft }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
        <div className="text-sm text-gray-800 flex-shrink-0 sm:w-1/2">{label}</div>
        <div className="text-xs sm:text-right sm:w-1/2">
          {match ? <MappedTag row={match} /> : <MissingTag />}
        </div>
      </div>
    </div>
  );
}

function formatLeafLabel(line: IndexLine): string {
  switch (line.kind) {
    case 'unit':
      return `Unit ${line.number}: ${line.title}`;
    case 'skills-focus':
      return `Skills focus: ${line.title}`;
    case 'practical-task':
      return `Practical task${line.number ? ' ' + line.number : ''}${line.title ? ': ' + line.title : ''}`;
    case 'case-study':
      return `Case study: ${line.title}`;
    default:
      return line.raw;
  }
}

function MappedTag({ row }: { row: MappingRow }) {
  return (
    <div className="inline-flex flex-col items-start sm:items-end text-left sm:text-right bg-green-50 border border-green-200 rounded px-2 py-1 w-full sm:w-auto">
      <div className="text-green-800 font-medium">
        {row.textbookTopicName || row.submoduleName}
      </div>
      <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
        <span>Topic ID: {row.id}</span>
        {row.mappingId != null && <span>Mapping ID: {row.mappingId}</span>}
        <span>Submodule: {row.submoduleId}</span>
      </div>
      {row.notes && (
        <div className="text-[10px] text-gray-600 mt-0.5 italic">Notes: {row.notes}</div>
      )}
    </div>
  );
}

function MissingTag() {
  return (
    <span className="inline-block bg-red-50 border border-red-200 text-red-700 rounded px-2 py-0.5 text-[11px] font-medium">
      (Missing Topic/Sub-Topic)
    </span>
  );
}

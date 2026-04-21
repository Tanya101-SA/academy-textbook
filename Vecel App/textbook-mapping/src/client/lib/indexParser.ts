export type IndexLineKind =
  | 'term'
  | 'topic'
  | 'unit'
  | 'skills-focus'
  | 'practical-task'
  | 'case-study'
  | 'topic-revision'
  | 'term-test'
  | 'other';

export interface IndexLine {
  raw: string;
  indent: number;
  kind: IndexLineKind;
  number?: number;
  title: string;
  mappable: boolean;
  termNumber?: number;
  topicNumber?: number;
}

export interface TextbookHeader {
  title: string;
  isbn?: string;
  publisher?: string;
  curriculum?: string;
}

export interface ParsedIndex {
  header: TextbookHeader;
  lines: IndexLine[];
}

const SKIP_LINES = new Set(['Cover', 'Title', 'TABLE OF CONTENTS', 'Glossary', 'Imprint page', 'Index']);

export function parseIndex(raw: string): ParsedIndex {
  const allLines = raw.split(/\r?\n/);
  const header: TextbookHeader = { title: '' };

  let i = 0;
  // Skip header separators and collect metadata
  while (i < allLines.length && /^=+$/.test(allLines[i].trim())) i++;
  if (i < allLines.length) header.title = allLines[i++].trim();
  while (i < allLines.length && !/^=+$/.test(allLines[i].trim())) {
    const line = allLines[i].trim();
    const m = line.match(/^(ISBN|Publisher|Curriculum):\s*(.+)$/i);
    if (m) {
      const key = m[1].toLowerCase() as keyof TextbookHeader;
      (header as Record<string, string>)[key] = m[2].trim();
    }
    i++;
  }

  // Skip until after TABLE OF CONTENTS divider
  let sawToC = false;
  while (i < allLines.length) {
    const t = allLines[i].trim();
    i++;
    if (/TABLE OF CONTENTS/i.test(t)) {
      sawToC = true;
      // Skip a divider line after it if present
      while (i < allLines.length && /^[─_\-=]+$/.test(allLines[i].trim())) i++;
      break;
    }
  }
  if (!sawToC) i = 0; // fallback: parse whole file

  const out: IndexLine[] = [];
  let currentTerm: number | undefined;
  let currentTopic: number | undefined;

  for (; i < allLines.length; i++) {
    const rawLine = allLines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (SKIP_LINES.has(trimmed)) continue;
    if (/^=+$/.test(trimmed) || /^[─_\-]+$/.test(trimmed)) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const parsed = classify(trimmed);

    if (parsed.kind === 'term' && parsed.number !== undefined) {
      currentTerm = parsed.number;
      currentTopic = undefined;
    } else if (parsed.kind === 'topic' && parsed.number !== undefined) {
      currentTopic = parsed.number;
    }

    out.push({
      raw: trimmed,
      indent,
      kind: parsed.kind,
      number: parsed.number,
      title: parsed.title,
      mappable: parsed.mappable,
      termNumber: currentTerm,
      topicNumber: currentTopic,
    });
  }

  return { header, lines: out };
}

function classify(text: string): { kind: IndexLineKind; number?: number; title: string; mappable: boolean } {
  let m: RegExpMatchArray | null;

  if ((m = text.match(/^Term\s+(\d+)\s*[–\-:]\s*(.+)$/i))) {
    return { kind: 'term', number: parseInt(m[1], 10), title: m[2].trim(), mappable: false };
  }
  if ((m = text.match(/^Term\s+(\d+)\s+(.+)$/i)) && m[2].trim()) {
    // "Term 1 test" / "Term 2 Exam"
    if (/^(test|exam|examination|assessment)$/i.test(m[2].trim())) {
      return { kind: 'term-test', number: parseInt(m[1], 10), title: m[2].trim(), mappable: false };
    }
    return { kind: 'term', number: parseInt(m[1], 10), title: m[2].trim(), mappable: false };
  }
  if ((m = text.match(/^Topic\s+(\d+)\s*[:\-]?\s*(.+)$/i))) {
    return { kind: 'topic', number: parseInt(m[1], 10), title: m[2].trim(), mappable: false };
  }
  if (/^Topic\s+revision$/i.test(text)) {
    return { kind: 'topic-revision', title: 'Topic revision', mappable: false };
  }
  if ((m = text.match(/^Unit\s+(\d+)\s*[:\-]?\s*(.+)$/i))) {
    return { kind: 'unit', number: parseInt(m[1], 10), title: m[2].trim(), mappable: true };
  }
  if ((m = text.match(/^Skills\s+focus\s*[:\-]?\s*(.+)$/i))) {
    return { kind: 'skills-focus', title: m[1].trim(), mappable: true };
  }
  if ((m = text.match(/^Practical\s+task\s*(\d+)?\s*[:\-]?\s*(.*)$/i))) {
    return { kind: 'practical-task', number: m[1] ? parseInt(m[1], 10) : undefined, title: (m[2] || '').trim(), mappable: true };
  }
  if ((m = text.match(/^Case\s+study\s*[:\-]?\s*(.+)$/i))) {
    return { kind: 'case-study', title: m[1].trim(), mappable: true };
  }

  return { kind: 'other', title: text, mappable: true };
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

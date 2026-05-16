// =============================================================================
// lib/lesson-plan/parse-blocks.ts — Parses AI markdown into typed blocks
// for our themed renderer. We don't use react-markdown here because we need
// to detect named sections (Objectives, Materials, Marking Grid) and route
// them to specific themed components rather than render generic markdown.
// =============================================================================

export type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string; namedSection?: NamedSection }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string; ordered: boolean; marks?: number }
  | { kind: 'hr' }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'code'; lang: string; text: string }

/** Section names we render with themed components. Case-insensitive match. */
export type NamedSection =
  | 'objectives' | 'materials' | 'warm-up' | 'main-activity'
  | 'assessment' | 'homework' | 'exit-ticket'
  | 'marking-grid' | 'teacher-comments'

const NAMED_SECTIONS: { keyword: RegExp; section: NamedSection }[] = [
  { keyword: /^objectives?\b/i,        section: 'objectives' },
  { keyword: /^materials?\b/i,         section: 'materials' },
  { keyword: /^warm[\s-]*up\b/i,       section: 'warm-up' },
  { keyword: /^main\s+activity\b/i,    section: 'main-activity' },
  { keyword: /^assessment\b/i,         section: 'assessment' },
  { keyword: /^homework\b/i,           section: 'homework' },
  { keyword: /^exit\s+ticket\b/i,      section: 'exit-ticket' },
  { keyword: /^marking\s+grid\b/i,     section: 'marking-grid' },
  { keyword: /^teacher.?s\s+comments?\b/i, section: 'teacher-comments' },
]

function detectNamedSection(text: string): NamedSection | undefined {
  for (const { keyword, section } of NAMED_SECTIONS) {
    if (keyword.test(text.trim())) return section
  }
  return undefined
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.includes('|', 1)
}

/** Extracts "(N marks)" from a list item, returns number or undefined. */
function extractMarks(text: string): number | undefined {
  const m = text.match(/\(\s*(\d+)\s+marks?\s*\)/i)
  return m ? Number(m[1]) : undefined
}

export function parseBlocks(md: string): Block[] {
  const lines = md.split('\n').map((l) => l.replace(/\r$/, ''))
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || ''
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      blocks.push({ kind: 'code', lang, text: buf.join('\n') })
      i++ // skip closing fence
      continue
    }

    // Table
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    if (!line.trim()) {
      // skip blank lines (paragraphs get spacing from CSS, not blank blocks)
      i++
      continue
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
    } else if (line.startsWith('### ')) {
      const text = line.slice(4)
      blocks.push({ kind: 'h3', text, namedSection: detectNamedSection(text) })
    } else if (line.startsWith('## ')) {
      const text = line.slice(3)
      blocks.push({ kind: 'h2', text, namedSection: detectNamedSection(text) })
    } else if (line.startsWith('# ')) {
      const text = line.slice(2)
      blocks.push({ kind: 'h1', text, namedSection: detectNamedSection(text) })
    } else if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '')
      blocks.push({ kind: 'li', text, ordered: false, marks: extractMarks(text) })
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, '')
      blocks.push({ kind: 'li', text, ordered: true, marks: extractMarks(text) })
    } else {
      blocks.push({ kind: 'p', text: line })
    }
    i++
  }

  return blocks
}

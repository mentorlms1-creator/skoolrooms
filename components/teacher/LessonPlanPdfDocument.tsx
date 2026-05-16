// =============================================================================
// components/teacher/LessonPlanPdfDocument.tsx — react-pdf document.
// Renders a lesson plan markdown body as a printable A4 PDF.
//
// Font: bundles DejaVu Sans (Latin + Greek + Cyrillic + math operators)
// so PDFs can render θ, π, √, ≥, °, ÷, ×, etc. The built-in Helvetica is
// a WinAnsi subset that mangles anything outside Latin-1.
//
// Supported markdown blocks: H1/H2/H3, paragraphs, ul / ol, GFM-style
// tables. Inline emphasis markers (*, **, `) are stripped — react-pdf
// doesn't support per-glyph styling inside a single Text.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Font registration ──────────────────────────────────────────────────
// Module-level: runs once per server instance. The TTFs are read off the
// filesystem (see next.config.ts outputFileTracingIncludes which pulls
// public/fonts/ into the function bundle on Vercel).
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
// react-pdf accepts a Buffer for `src` at runtime even though the
// TypeScript types only declare `string`. Cast through `unknown`.
Font.register({
  family: 'DejaVu Sans',
  fonts: [
    {
      src: fs.readFileSync(path.join(FONTS_DIR, 'DejaVuSans.ttf')) as unknown as string,
      fontWeight: 400,
    },
    {
      src: fs.readFileSync(path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf')) as unknown as string,
      fontWeight: 700,
    },
  ],
})
// Disable hyphenation — splits Greek/math poorly and looks bad in print.
Font.registerHyphenationCallback((word) => [word])

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'DejaVu Sans',
    color: '#111',
  },
  header: {
    borderBottom: '1pt solid #888',
    paddingBottom: 8,
    marginBottom: 16,
  },
  courseLine: { fontSize: 10, color: '#666' },
  title: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  meta: { fontSize: 9, color: '#888', marginTop: 4 },
  h1: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 11, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 4, lineHeight: 1.4 },
  li: { marginLeft: 14, marginBottom: 2 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
  // ─── Table ─────────────────────────────────────────────────────────
  table: {
    marginVertical: 6,
    borderWidth: 0.5,
    borderColor: '#888',
    borderStyle: 'solid',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: { flexDirection: 'row' },
  tableHeaderCell: {
    flex: 1,
    padding: 4,
    fontSize: 10,
    fontWeight: 700,
    backgroundColor: '#eee',
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#888',
    borderStyle: 'solid',
  },
  tableCell: {
    flex: 1,
    padding: 4,
    fontSize: 10,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#888',
    borderStyle: 'solid',
  },
})

// ─── Markdown parsing ───────────────────────────────────────────────────

type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { kind: 'li'; text: string; ordered: boolean }
  | { kind: 'table'; header: string[]; rows: string[][] }

function parseTableRow(line: string): string[] {
  // Strip leading/trailing pipe, split, trim.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  // GFM separator: |---|:--:|---:|
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.includes('|', 1)
}

export function parseMarkdown(md: string): Block[] {
  const lines = md.split('\n').map((l) => l.replace(/\r$/, ''))
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Table: a row line, followed by a separator, followed by more row lines.
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const header = parseTableRow(line)
      const rows: string[][] = []
      i += 2 // skip header + separator
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    if (!line.trim()) {
      blocks.push({ kind: 'p', text: '' })
    } else if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: line.slice(4) })
    } else if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3) })
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2) })
    } else if (/^\s*[-*]\s+/.test(line)) {
      blocks.push({
        kind: 'li',
        text: line.replace(/^\s*[-*]\s+/, ''),
        ordered: false,
      })
    } else if (/^\s*\d+\.\s+/.test(line)) {
      blocks.push({
        kind: 'li',
        text: line.replace(/^\s*\d+\.\s+/, ''),
        ordered: true,
      })
    } else {
      blocks.push({ kind: 'p', text: line })
    }
    i++
  }
  return blocks
}

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}

// ─── Component ──────────────────────────────────────────────────────────

export type LessonPlanPdfProps = {
  courseName: string
  teacherName: string
  title: string
  bodyMarkdown: string
  /** When the plan content was last produced or revised (PKT). */
  updatedAtPkt: string
}

export function LessonPlanPdfDocument(props: LessonPlanPdfProps) {
  const blocks = parseMarkdown(props.bodyMarkdown)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.courseLine}>
            {props.teacherName} · {props.courseName}
          </Text>
          <Text style={s.title}>{props.title}</Text>
          <Text style={s.meta}>Last updated {props.updatedAtPkt} (PKT)</Text>
        </View>
        {blocks.map((b, i) => {
          if (b.kind === 'table') {
            return (
              <View key={i} style={s.table} wrap={false}>
                <View style={s.tableRow}>
                  {b.header.map((h, hi) => (
                    <Text key={hi} style={s.tableHeaderCell}>
                      {stripInline(h)}
                    </Text>
                  ))}
                </View>
                {b.rows.map((row, ri) => (
                  <View key={ri} style={s.tableRow}>
                    {/* Pad short rows to header width so the table doesn't get jagged. */}
                    {Array.from({ length: b.header.length }).map((_, ci) => (
                      <Text key={ci} style={s.tableCell}>
                        {stripInline(row[ci] ?? '')}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )
          }
          const t = stripInline(b.text)
          if (b.kind === 'h1') return <Text key={i} style={s.h1}>{t}</Text>
          if (b.kind === 'h2') return <Text key={i} style={s.h2}>{t}</Text>
          if (b.kind === 'h3') return <Text key={i} style={s.h3}>{t}</Text>
          if (b.kind === 'li') return (
            <Text key={i} style={s.li}>
              • {t}
            </Text>
          )
          return <Text key={i} style={s.p}>{t}</Text>
        })}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated with Skool Rooms · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

// =============================================================================
// components/teacher/LessonPlanPdfDocument.tsx — react-pdf document.
// Renders a lesson plan markdown body as a printable A4 PDF. We do NOT use
// full markdown rendering — just the elements lesson plans actually use:
// H1/H2/H3, paragraphs, ul/ol, basic inline emphasis.
// =============================================================================

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
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
})

type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { kind: 'li'; text: string; ordered: boolean }

function parseMarkdown(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (!line.trim()) {
      blocks.push({ kind: 'p', text: '' })
      continue
    }
    if (line.startsWith('### ')) {
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
  }
  return blocks
}

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}

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
          const t = stripInline(b.text)
          if (b.kind === 'h1') return <Text key={i} style={s.h1}>{t}</Text>
          if (b.kind === 'h2') return <Text key={i} style={s.h2}>{t}</Text>
          if (b.kind === 'h3') return <Text key={i} style={s.h3}>{t}</Text>
          if (b.kind === 'li')
            return (
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

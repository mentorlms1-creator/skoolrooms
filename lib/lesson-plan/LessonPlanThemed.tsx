// =============================================================================
// lib/lesson-plan/LessonPlanThemed.tsx — Themed lesson plan renderer.
// One component, two consumers:
//   - context="web"  → renders <article> only, no <html> wrapper,
//                       no @page CSS, no cover header (page has title already)
//   - context="pdf"  → renders a complete standalone HTML document with
//                       print CSS, embedded font @font-face rules, cover header
// =============================================================================

import type { Theme, DocType, FontFace } from './themes/types'
import { parseBlocks, type Block } from './parse-blocks'
import {
  Heading, Paragraph, List, Table, Divider, CoverHeader,
} from './blocks'

type RenderContext = 'web' | 'pdf'

type Props = {
  theme: Theme
  context: RenderContext
  title: string
  bodyMarkdown: string
  courseName: string
  teacherName: string
  updatedAtPkt: string
  docType?: DocType
}

function renderBlock(block: Block, theme: Theme, key: number): React.ReactNode {
  switch (block.kind) {
    case 'h1':
      return <Heading key={key} level={1} text={block.text} theme={theme} />
    case 'h2':
      return <Heading key={key} level={2} text={block.text} theme={theme} />
    case 'h3':
      return <Heading key={key} level={3} text={block.text} theme={theme} />
    case 'p':
      return <Paragraph key={key} text={block.text} theme={theme} />
    case 'hr':
      return <Divider key={key} theme={theme} />
    case 'table':
      return <Table key={key} header={block.header} rows={block.rows} theme={theme} />
    case 'code':
      return (
        <pre key={key} style={{
          fontFamily: theme.tokens.font.mono,
          fontSize: '.85em',
          background: theme.tokens.color.divider + '40',
          padding: '8px 12px',
          borderRadius: '4px',
          margin: '8px 0',
          overflow: 'auto',
        }}>{block.text}</pre>
      )
    case 'li':
      return (
        <List key={key} items={[{ text: block.text, ordered: block.ordered, marks: block.marks }]} theme={theme} />
      )
  }
}

function renderBody(blocks: Block[], theme: Theme): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.kind === 'li') {
      const items: { text: string; ordered: boolean; marks?: number }[] = []
      while (i < blocks.length && blocks[i].kind === 'li') {
        const b = blocks[i] as Extract<Block, { kind: 'li' }>
        items.push({ text: b.text, ordered: b.ordered, marks: b.marks })
        i++
      }
      nodes.push(<List key={i} items={items} theme={theme} />)
    } else {
      nodes.push(renderBlock(block, theme, i))
      i++
    }
  }
  return nodes
}

function buildFontFaceCss(faces: FontFace[] | undefined): string {
  if (!faces) return ''
  return faces.map((f) =>
    `@font-face {
      font-family: '${f.family}';
      src: url('${f.src}') format('woff2');
      font-weight: ${f.weight};
      font-style: ${f.style ?? 'normal'};
      font-display: swap;
    }`
  ).join('\n')
}

function buildPrintCss(theme: Theme): string {
  return `
    @page {
      size: ${theme.tokens.page.size};
      margin: ${theme.tokens.page.margin};
    }
    @media print {
      body { font-size: 11pt; }
      h1, h2, h3 { break-after: avoid; }
      table { break-inside: auto; }
    }
  `
}

export function LessonPlanThemed(props: Props) {
  const { theme, context, title, bodyMarkdown, courseName, teacherName, updatedAtPkt, docType = 'lesson-plan' } = props
  const blocks = parseBlocks(bodyMarkdown)

  const article = (
    <article style={{
      fontFamily: theme.tokens.font.body,
      color: theme.tokens.color.text,
      background: theme.tokens.color.surface,
      maxWidth: context === 'pdf' ? 'none' : '760px',
      margin: context === 'pdf' ? '0' : '0 auto',
      padding: context === 'pdf' ? '0' : '0',
      lineHeight: 1.55,
    }}>
      {context === 'pdf' && (
        <CoverHeader
          theme={theme}
          courseName={courseName}
          teacherName={teacherName}
          title={title}
          updatedAtPkt={updatedAtPkt}
          docType={docType}
        />
      )}
      {renderBody(blocks, theme)}
    </article>
  )

  if (context === 'web') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: buildFontFaceCss(theme.tokens.fontFaces) }} />
        {article}
      </>
    )
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <style dangerouslySetInnerHTML={{ __html: buildFontFaceCss(theme.tokens.fontFaces) }} />
        <style dangerouslySetInnerHTML={{ __html: buildPrintCss(theme) }} />
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; background: ${theme.tokens.color.surface}; }
        ` }} />
      </head>
      <body>{article}</body>
    </html>
  )
}

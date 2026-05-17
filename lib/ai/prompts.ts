// =============================================================================
// lib/ai/prompts.ts — Prompt builders for generate / revise.
// Output format is enforced via system prompt: TITLE: <title>\n---\n<markdown>.
// The "themed" variants add THEME: + DOC_TYPE: metadata lines above TITLE:
// for the themed-PDF feature.
// =============================================================================

import type { PlanInput, ChatTurn } from './provider'
import type { ThemeSlug, DocType } from '@/lib/lesson-plan/themes/types'

const OUTPUT_FORMAT = `
You MUST respond in exactly this format and nothing else:

TITLE: <a short descriptive title, max 200 characters>
---
<the lesson plan body in markdown>

Do not include any preamble, commentary, or trailing notes outside this format.
`

const SECTION_RULES_SESSION = `
For a single-session plan, use these markdown H2 headings in order:
## Objectives
## Materials
## Warm-up
## Main Activity
## Assessment
## Homework
`

const SECTION_RULES_UNIT = `
For a multi-week unit plan, structure as H2 headings per week:
## Week 1: <topic for this week>
### Objectives
### Activities
### Assessment

Repeat for each week up to the requested week count.
`

const PAKISTAN_CONTEXT = `
The teacher is in Pakistan. Be aware of curricula (Federal Board, Cambridge, CBSE).
Use metric units. If money is mentioned, use PKR.
`

function languageInstruction(lang: PlanInput['language']): string {
  switch (lang) {
    case 'urdu':
      return 'Write the BODY content in Urdu. Keep section HEADINGS in English.'
    case 'roman-urdu':
      return 'Write the BODY content in Roman Urdu (Urdu transliterated in Latin script). Keep section HEADINGS in English.'
    default:
      return 'Write the entire plan in English.'
  }
}

export function buildSystemPrompt(input: PlanInput): string {
  return [
    'You are an assistant helping a Pakistani tutor draft a lesson plan.',
    PAKISTAN_CONTEXT,
    languageInstruction(input.language),
    input.scope === 'session' ? SECTION_RULES_SESSION : SECTION_RULES_UNIT,
    OUTPUT_FORMAT,
  ].join('\n')
}

export function buildGeneratePrompt(input: PlanInput): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
    `Learning goals: ${input.learningGoals}`,
  ]
  if (input.scope === 'session') {
    lines.push(`Duration: ${input.durationMinutes ?? 60} minutes`)
  } else {
    lines.push(`Number of weeks: ${input.weekCount ?? 4}`)
  }
  const planType = input.scope === 'session' ? 'single-session' : 'multi-week unit'
  return `Create a ${planType} lesson plan with the following details:\n\n${lines.join('\n')}`
}

export function buildRevisePrompt(args: {
  currentMarkdown: string
  chatHistory: ChatTurn[]
  instruction: string
}): string {
  const recent = args.chatHistory
    .slice(-5)
    .map((t) => `${t.role.toUpperCase()}: ${t.content.slice(0, 500)}`)
    .join('\n')
  return [
    'Here is the current lesson plan:',
    '```markdown',
    args.currentMarkdown,
    '```',
    '',
    'Recent conversation:',
    recent || '(none)',
    '',
    `New instruction from the teacher: ${args.instruction}`,
    '',
    'Return the FULL updated lesson plan in the required TITLE/--- format.',
  ].join('\n')
}

// =============================================================================
// THEMED variants — emit THEME: + DOC_TYPE: metadata before TITLE.
// =============================================================================

const THEME_DESCRIPTIONS = `
- classroom-classic — neutral, safe default, any subject
- modern-notebook — warm, friendly, primary / middle school
- worksheet-pro — black & white worksheet style, for assessment / homework
- academic-minimal — formal, generous whitespace, multi-week units
- playful-primary — bright/friendly, K-3 ages
- tech-stem — clean blue accent, math / science / computing
- studio-pad — sketchbook feel, art / craft / drawing
- canvas — gallery aesthetic, photography / design
`

const METADATA_FORMAT_AUTO = `
You will pick a visual theme for this lesson plan. Your first two output lines MUST be:

THEME: <one of: classroom-classic, modern-notebook, worksheet-pro, academic-minimal, playful-primary, tech-stem, studio-pad, canvas>
DOC_TYPE: <one of: lesson-plan, assessment-sheet, worksheet>

Use these theme descriptions to choose:
${THEME_DESCRIPTIONS}

Then the existing format:
TITLE: <a short descriptive title, max 200 characters>
---
<the lesson plan body in markdown>
`

function metadataFormatFixed(slug: ThemeSlug): string {
  return `
Your first two output lines MUST be:

THEME: ${slug}
DOC_TYPE: <one of: lesson-plan, assessment-sheet, worksheet>

Then the existing format:
TITLE: <a short descriptive title, max 200 characters>
---
<the lesson plan body in markdown>
`
}

export function buildSystemPromptThemed(
  input: PlanInput,
  themeSlug: ThemeSlug | null,
): string {
  const meta = themeSlug ? metadataFormatFixed(themeSlug) : METADATA_FORMAT_AUTO
  return [
    'You are an assistant helping a Pakistani tutor draft a lesson plan.',
    PAKISTAN_CONTEXT,
    languageInstruction(input.language),
    input.scope === 'session' ? SECTION_RULES_SESSION : SECTION_RULES_UNIT,
    meta,
    'Do not include any preamble, commentary, or trailing notes outside this format.',
  ].join('\n')
}

export function buildRevisePromptThemed(args: {
  themeSlug: ThemeSlug
  docType: DocType
  currentMarkdown: string
  chatHistory: ChatTurn[]
  instruction: string
}): { system: string; prompt: string } {
  const system = [
    "You are revising an existing lesson plan. Keep the teacher's intent and the existing structure unless the instruction says otherwise.",
    `The theme is ${args.themeSlug} and document type is ${args.docType} — DO NOT change these.`,
    'You MUST respond in exactly this format and nothing else:',
    '',
    'TITLE: <a short descriptive title, max 200 characters>',
    '---',
    '<the full updated lesson plan body in markdown>',
    '',
    'Do NOT include THEME: or DOC_TYPE: lines in your revision output.',
    'Do not include any preamble, commentary, or trailing notes outside this format.',
  ].join('\n')

  const recent = args.chatHistory
    .slice(-5)
    .map((t) => `${t.role.toUpperCase()}: ${t.content.slice(0, 500)}`)
    .join('\n')
  const prompt = [
    'Current lesson plan:',
    '```markdown',
    args.currentMarkdown,
    '```',
    '',
    'Recent conversation:',
    recent || '(none)',
    '',
    `New instruction from the teacher: ${args.instruction}`,
    '',
    'Return the FULL updated plan in the required TITLE/--- format.',
  ].join('\n')

  return { system, prompt }
}

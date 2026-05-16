'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { THEMES } from '@/lib/lesson-plan/themes'
import type { Theme, ThemeSlug } from '@/lib/lesson-plan/themes/types'

export type ThemePickerValue = ThemeSlug | null  // null = "Auto"

type Props = {
  value: ThemePickerValue
  onChange: (next: ThemePickerValue) => void
  disabled?: boolean
}

function MiniPreview({ theme }: { theme: Theme }) {
  return (
    <div style={{
      background: theme.tokens.color.surface,
      color: theme.tokens.color.text,
      fontFamily: theme.tokens.font.body,
      padding: '12px 14px',
      borderRadius: '6px',
      border: `1px solid ${theme.tokens.color.divider}`,
      fontSize: '12px',
      lineHeight: 1.4,
      minHeight: '120px',
    }}>
      <div style={{
        fontFamily: theme.tokens.font.heading,
        color: theme.tokens.color.primary,
        fontSize: '14px',
        fontWeight: 700,
        marginBottom: '4px',
      }}>Introduction to Trigonometry</div>
      <div style={{ fontSize: '10px', color: theme.tokens.color.muted, marginBottom: '8px' }}>
        Class 9 · 60 min
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>Objectives</div>
      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px' }}>
        <li>Define sin / cos / tan ratios</li>
        <li>Apply Pythagoras to right triangles</li>
      </ul>
    </div>
  )
}

function AutoPreview() {
  return (
    <div style={{
      background: '#fafafa',
      color: '#525252',
      padding: '12px 14px',
      borderRadius: '6px',
      border: '1px dashed #d4d4d4',
      fontSize: '12px',
      minHeight: '120px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}>
      ✨ AI will pick a theme based on subject, grade, and scope when you generate.
    </div>
  )
}

export function ThemePickerField({ value, onChange, disabled }: Props) {
  const selectedTheme = useMemo(() => value ? THEMES[value] : null, [value])

  return (
    <div className="space-y-2">
      <Label htmlFor="theme-slug">Theme</Label>
      <Select
        value={value ?? 'auto'}
        onValueChange={(v) => onChange(v === 'auto' ? null : (v as ThemeSlug))}
        disabled={disabled}
      >
        <SelectTrigger id="theme-slug"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">✨ Auto — let AI pick</SelectItem>
          {(Object.values(THEMES)).map((t) => (
            <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-2">
        {selectedTheme ? <MiniPreview theme={selectedTheme} /> : <AutoPreview />}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedTheme ? selectedTheme.description : 'Auto picks based on your inputs.'}
      </p>
    </div>
  )
}

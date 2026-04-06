'use client'

/**
 * components/ui/RichTextEditor.tsx — TipTap rich text editor with toolbar
 * Client Component (uses hooks). For course descriptions, announcements, etc.
 */

import { useRef, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import type { Editor } from '@tiptap/react'
import { Bold, Italic, Heading2, Heading3, List, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type RichTextEditorProps = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  label?: string
  error?: string
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(editor.isActive('bold') && 'bg-primary/20 text-primary')}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(editor.isActive('italic') && 'bg-primary/20 text-primary')}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn(editor.isActive('heading', { level: 2 }) && 'bg-primary/20 text-primary')}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={cn(editor.isActive('heading', { level: 3 }) && 'bg-primary/20 text-primary')}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(editor.isActive('bulletList') && 'bg-primary/20 text-primary')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(editor.isActive('orderedList') && 'bg-primary/20 text-primary')}
        title="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  label,
  error,
}: RichTextEditorProps) {
  // Track whether the latest content change came from the editor itself
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? 'Start typing...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ],
    content,
    onUpdate: ({ editor: updatedEditor }) => {
      isInternalUpdate.current = true
      onChange(updatedEditor.getHTML())
    },
  })

  // Sync editor content when the content prop changes externally (e.g. form reset)
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    // Only update if the editor content actually differs from the prop
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const editorId = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={editorId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'rounded-md border bg-card',
          error ? 'border-destructive' : 'border-border',
        )}
      >
        {editor && <Toolbar editor={editor} />}
        <EditorContent
          id={editorId}
          editor={editor}
          className="prose prose-sm max-w-none px-3 py-2 min-h-[200px] text-foreground [&_.tiptap]:outline-none [&_.tiptap]:min-h-[200px] [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

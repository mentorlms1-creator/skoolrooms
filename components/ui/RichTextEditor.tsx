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

type RichTextEditorProps = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  label?: string
  error?: string
}

type ToolbarButtonProps = {
  onClick: () => void
  isActive: boolean
  children: React.ReactNode
  title: string
}

function ToolbarButton({ onClick, isActive, children, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`
        rounded px-2 py-1 text-sm font-medium transition-colors
        ${
          isActive
            ? 'bg-brand-100 text-brand-600'
            : 'text-muted hover:bg-paper'
        }
      `}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        &bull; List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Ordered List"
      >
        1. List
      </ToolbarButton>
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
          class: 'text-brand-600 underline',
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
          className="text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <div
        className={`
          rounded-md border
          ${error ? 'border-danger' : 'border-border'}
        `}
      >
        {editor && <Toolbar editor={editor} />}
        <EditorContent
          id={editorId}
          editor={editor}
          className="prose prose-sm max-w-none px-3 py-2 min-h-[200px] text-ink [&_.tiptap]:outline-none [&_.tiptap]:min-h-[200px] [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
        />
      </div>
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
    </div>
  )
}

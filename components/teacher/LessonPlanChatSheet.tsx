'use client'

/**
 * components/teacher/LessonPlanChatSheet.tsx
 * Client Component — Mobile-only floating action button that opens the chat
 * panel in a bottom drawer. Hidden on md+ where the desktop side panel shows.
 */

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { LessonPlanChat, type ChatTurn } from './LessonPlanChat'

type Props = {
  planId: string
  chatHistory: ChatTurn[]
}

export function LessonPlanChatSheet({ planId, chatHistory }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg md:hidden"
          aria-label="Revise with AI"
        >
          <Sparkles className="h-4 w-4" />
          Revise with AI
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] p-0">
        <SheetTitle className="sr-only">Revise with AI</SheetTitle>
        <div className="h-full">
          <LessonPlanChat planId={planId} chatHistory={chatHistory} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

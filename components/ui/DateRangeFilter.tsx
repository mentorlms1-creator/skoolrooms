'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { DateRange } from 'react-day-picker'

const PRESETS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
] as const

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  try {
    return parseISO(value)
  } catch {
    return undefined
  }
}

export function DateRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPeriod = searchParams.get('period') || 'this_month'

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parseDateParam(searchParams.get('from'))
    const to = parseDateParam(searchParams.get('to'))
    if (from) return { from, to }
    return undefined
  })

  function handlePresetChange(preset: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', preset)
    if (preset !== 'custom') {
      params.delete('from')
      params.delete('to')
    }
    router.push(`?${params.toString()}`)
  }

  function handleCustomRange(range: DateRange | undefined) {
    setDateRange(range)
    if (range?.from && range?.to) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('period', 'custom')
      params.set('from', format(range.from, 'yyyy-MM-dd'))
      params.set('to', format(range.to, 'yyyy-MM-dd'))
      router.push(`?${params.toString()}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={currentPeriod} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currentPeriod === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[220px] justify-start text-left font-normal',
                !dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, 'MMM d')} \u2013 ${format(dateRange.to, 'MMM d')}`
                : 'Pick a date range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleCustomRange}
              numberOfMonths={2}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

import type { JSX } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@cems/ui'

interface FieldHelpTooltipProps {
  content: string
  label?: string
}

export function FieldHelpTooltip({ content, label = 'Help' }: FieldHelpTooltipProps): JSX.Element {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground min-h-[48px] min-w-[48px] text-xs font-bold ml-1 flex-shrink-0 cursor-pointer"
          aria-label={label}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[240px] text-sm">{content}</PopoverContent>
    </Popover>
  )
}

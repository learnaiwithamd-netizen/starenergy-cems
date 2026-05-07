import * as React from 'react'
import { cn } from '../lib/utils.js'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm',
        'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-vertical',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }

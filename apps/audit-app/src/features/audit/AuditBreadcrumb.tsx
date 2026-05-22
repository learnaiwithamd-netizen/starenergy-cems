import type { JSX } from 'react'
import { Link } from 'react-router-dom'

export interface BreadcrumbSegment {
  label: string
  to?: string
}

interface AuditBreadcrumbProps {
  segments: BreadcrumbSegment[]
}

export function AuditBreadcrumb({ segments }: AuditBreadcrumbProps): JSX.Element {
  return (
    <nav aria-label="Audit navigation" className="mb-4">
      <ol className="flex items-center flex-wrap gap-x-1 text-sm text-muted">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          return (
            <li key={index} className="flex items-center gap-x-1">
              {index > 0 && (
                <span aria-hidden="true" className="mx-1 text-muted">
                  ›
                </span>
              )}
              {!isLast && segment.to ? (
                <Link
                  to={segment.to}
                  className="text-primary underline hover:opacity-80 max-w-[30vw] truncate inline-block align-bottom"
                >
                  {segment.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={
                    isLast
                      ? 'text-foreground font-medium max-w-[30vw] truncate inline-block align-bottom'
                      : 'text-muted max-w-[30vw] truncate inline-block align-bottom'
                  }
                >
                  {segment.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

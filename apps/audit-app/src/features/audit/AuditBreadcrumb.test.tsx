import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { AuditBreadcrumb } from './AuditBreadcrumb'

function renderBreadcrumb(segments: { label: string; to?: string }[]) {
  return render(
    <MemoryRouter>
      <AuditBreadcrumb segments={segments} />
    </MemoryRouter>,
  )
}

describe('AuditBreadcrumb', () => {
  it('renders nav with accessible label', () => {
    renderBreadcrumb([{ label: 'Refrigeration' }])
    expect(screen.getByRole('navigation', { name: 'Audit navigation' })).toBeDefined()
  })

  it('single segment renders with aria-current=page, no link', () => {
    renderBreadcrumb([{ label: 'Refrigeration' }])
    const el = screen.getByText('Refrigeration')
    expect(el.getAttribute('aria-current')).toBe('page')
    expect(el.tagName).not.toBe('A')
  })

  it('two segments: first is a link, second has aria-current=page', () => {
    renderBreadcrumb([
      { label: 'Refrigeration', to: '/audit/abc' },
      { label: 'Machine Room' },
    ])
    const link = screen.getByRole('link', { name: 'Refrigeration' })
    expect(link.getAttribute('href')).toBe('/audit/abc')
    const current = screen.getByText('Machine Room')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('three segments: first two are links, last is current', () => {
    renderBreadcrumb([
      { label: 'Refrigeration', to: '/audit/abc' },
      { label: 'Machine Room', to: '/audit/abc/section/refrigeration' },
      { label: 'Ventilation' },
    ])
    expect(screen.getByRole('link', { name: 'Refrigeration' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Machine Room' })).toBeDefined()
    const current = screen.getByText('Ventilation')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('renders › separators between segments', () => {
    renderBreadcrumb([
      { label: 'Refrigeration', to: '/audit/abc' },
      { label: 'Machine Room' },
    ])
    const separators = document.querySelectorAll('[aria-hidden="true"]')
    expect(separators.length).toBeGreaterThanOrEqual(1)
    expect(separators[0]!.textContent).toContain('›')
  })

  it('passes axe accessibility scan', async () => {
    const { container } = renderBreadcrumb([
      { label: 'Refrigeration', to: '/audit/abc' },
      { label: 'Machine Room' },
    ])
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

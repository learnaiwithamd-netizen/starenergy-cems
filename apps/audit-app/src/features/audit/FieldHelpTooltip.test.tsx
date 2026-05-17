import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { FieldHelpTooltip } from './FieldHelpTooltip'

describe('FieldHelpTooltip', () => {
  it('renders a button with aria-label Help by default', () => {
    render(<FieldHelpTooltip content="Some help text" />)
    expect(screen.getByRole('button', { name: 'Help' })).toBeDefined()
  })

  it('uses custom label when provided', () => {
    render(<FieldHelpTooltip content="Some help text" label="Machine Room ID help" />)
    expect(screen.getByRole('button', { name: 'Machine Room ID help' })).toBeDefined()
  })

  it('shows popover content after clicking the button', async () => {
    const user = userEvent.setup()
    render(<FieldHelpTooltip content="Select a unique identifier for this machine room" />)
    const button = screen.getByRole('button', { name: 'Help' })
    await user.click(button)
    expect(await screen.findByText('Select a unique identifier for this machine room')).toBeDefined()
  })

  it('passes axe scan with popover closed', async () => {
    const { container } = render(<FieldHelpTooltip content="Some help text" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('passes axe scan with popover open', async () => {
    const user = userEvent.setup()
    const { container } = render(<FieldHelpTooltip content="Some help text" />)
    await user.click(screen.getByRole('button', { name: 'Help' }))
    await screen.findByText('Some help text')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

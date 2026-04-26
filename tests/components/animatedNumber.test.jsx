// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnimatedNumber from '../../src/components/common/AnimatedNumber.jsx'

describe('components/AnimatedNumber', () => {
  it('keeps the previous value visible briefly while the next value settles', () => {
    vi.useFakeTimers()

    const { rerender } = render(<AnimatedNumber value="100" data-testid="metric" />)
    expect(screen.getByTestId('metric-current')).toHaveTextContent('100')
    expect(screen.queryByTestId('metric-previous')).not.toBeInTheDocument()

    rerender(<AnimatedNumber value="200" data-testid="metric" />)

    expect(screen.getByTestId('metric-previous')).toHaveTextContent('100')
    expect(screen.getByTestId('metric-current')).toHaveTextContent('200')
    expect(screen.getByTestId('metric-previous')).toHaveStyle({
      opacity: '0.6',
      transform: 'translateY(4px)',
    })

    act(() => {
      vi.advanceTimersByTime(280)
    })

    expect(screen.queryByTestId('metric-previous')).not.toBeInTheDocument()
    expect(screen.getByTestId('metric-current')).toHaveTextContent('200')

    vi.useRealTimers()
  })
})

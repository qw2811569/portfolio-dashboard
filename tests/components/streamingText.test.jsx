// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StreamingText from '../../src/components/common/StreamingText.jsx'

const originalMatchMedia = window.matchMedia

function mockReducedMotion(matches) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('components/StreamingText', () => {
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  })

  it('appends text one character at a time while streaming', () => {
    vi.useFakeTimers()
    mockReducedMotion(false)

    render(<StreamingText data-testid="stream" text="市場" streaming revealMs={8} />)

    expect(screen.getByTestId('stream')).toHaveTextContent('')

    act(() => {
      vi.advanceTimersByTime(8)
    })
    expect(screen.getByTestId('stream')).toHaveTextContent('市')

    act(() => {
      vi.advanceTimersByTime(8)
    })
    expect(screen.getByTestId('stream')).toHaveTextContent('市場')
  })

  it('renders full text immediately when streaming is false', () => {
    mockReducedMotion(false)

    render(<StreamingText data-testid="stream" text="立即完成" streaming={false} />)

    expect(screen.getByTestId('stream')).toHaveTextContent('立即完成')
  })

  it('renders full text immediately when reduced motion is enabled', () => {
    mockReducedMotion(true)

    render(<StreamingText data-testid="stream" text="減少動態" streaming />)

    expect(screen.getByTestId('stream')).toHaveTextContent('減少動態')
  })
})

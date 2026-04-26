// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OnboardingTour, {
  ONBOARDING_STORAGE_KEY,
} from '../../src/components/onboarding/OnboardingTour.jsx'

describe('components/OnboardingTour', () => {
  it('opens for first-time users and completes four steps', () => {
    const onNavigate = vi.fn()
    localStorage.getItem.mockReturnValue('')

    render(<OnboardingTour onNavigate={onNavigate} />)

    expect(screen.getByTestId('onboarding-tour')).toHaveTextContent('歡迎')
    fireEvent.click(screen.getByTestId('onboarding-next'))
    expect(screen.getByTestId('onboarding-tour')).toHaveTextContent('先建組合')
    fireEvent.click(screen.getByTestId('onboarding-next'))
    fireEvent.click(screen.getByTestId('onboarding-next'))
    fireEvent.click(screen.getByTestId('onboarding-next'))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      ONBOARDING_STORAGE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    )
    expect(onNavigate).toHaveBeenCalledWith('daily')
  })

  it('can be replayed manually after completion', () => {
    localStorage.getItem.mockReturnValue('2026-04-26T00:00:00.000Z')
    const { rerender } = render(<OnboardingTour key={0} replayToken={0} />)
    expect(screen.queryByTestId('onboarding-tour')).not.toBeInTheDocument()

    rerender(<OnboardingTour key={1} replayToken={1} />)
    expect(screen.getByTestId('onboarding-tour')).toBeInTheDocument()
  })
})

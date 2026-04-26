// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AnimatedNumber from '../../src/components/common/AnimatedNumber.jsx'
import PanelMount from '../../src/components/common/PanelMount.jsx'

describe('motion primitives', () => {
  it('renders animated numbers without counting from zero', () => {
    const { rerender } = render(<AnimatedNumber value="93,926" data-testid="metric" />)
    expect(screen.getByTestId('metric')).toHaveTextContent('93,926')

    rerender(<AnimatedNumber value="+58" data-testid="metric" />)
    expect(screen.getByTestId('metric')).toHaveTextContent('+58')
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('wraps panel content with the shared mount class', () => {
    render(
      <PanelMount data-testid="panel">
        <span>Daily</span>
      </PanelMount>
    )

    expect(screen.getByTestId('panel')).toHaveClass('panel-mount')
  })
})

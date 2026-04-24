// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TradeDisclaimerModal } from '../../src/components/trade/TradeDisclaimerModal.jsx'

let originalOffsetWidthDescriptor
let originalOffsetHeightDescriptor
let originalGetClientRects

describe('components/TradeDisclaimerModal', () => {
  beforeEach(() => {
    originalOffsetWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth'
    )
    originalOffsetHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight'
    )
    originalGetClientRects = HTMLElement.prototype.getClientRects

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return 120
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return 40
      },
    })
    HTMLElement.prototype.getClientRects = function getClientRects() {
      return [{ width: 120, height: 40 }]
    }
  })

  afterEach(() => {
    if (originalOffsetWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidthDescriptor)
    }
    if (originalOffsetHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeightDescriptor)
    }
    HTMLElement.prototype.getClientRects = originalGetClientRects
  })

  it('moves focus back to the checkbox when Escape is pressed', async () => {
    render(<TradeDisclaimerModal open checked={false} />)

    await waitFor(() => {
      expect(screen.getByTestId('trade-disclaimer-checkbox')).toHaveFocus()
    })

    screen.getByText('Legal 四欄詳情').focus()
    expect(screen.getByText('Legal 四欄詳情')).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTestId('trade-disclaimer-checkbox')).toHaveFocus()
    })
  })
})

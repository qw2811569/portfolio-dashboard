// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ParseResults } from '../../src/components/trade/TradePanel.jsx'

function TradeParseProbe() {
  const [parsed, setParsed] = useState({
    trades: [{ action: '買進', name: '台積電', code: '2330', qty: 10, price: 950 }],
  })

  return (
    <ParseResults
      parsed={parsed}
      setParsed={setParsed}
      qs={['為什麼買進？']}
      memoAns={[]}
      memoIn=""
      setMemoIn={() => {}}
      memoStep={0}
      submitMemo={() => {}}
    />
  )
}

describe('components/TradePanel dialogs', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('edits parsed trade fields through modal dialog without prompt()', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')

    render(<TradeParseProbe />)

    fireEvent.click(screen.getByText('台積電'))
    expect(screen.getByRole('dialog', { name: '修正名稱' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('新的名稱'), {
      target: { value: '台積電 ADR' },
    })
    fireEvent.click(screen.getByRole('button', { name: '套用修正' }))

    expect(promptSpy).not.toHaveBeenCalled()
    expect(await screen.findByText('台積電 ADR', {}, { timeout: 10000 })).toBeInTheDocument()
  }, 10000)
})

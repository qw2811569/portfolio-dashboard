import { useEffect, useMemo, useState } from 'react'

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function StreamingText({
  text = '',
  streaming = false,
  revealMs = 8,
  as: Component = 'span',
  ...props
}) {
  const value = String(text || '')
  const reduceMotion = useMemo(() => prefersReducedMotion(), [])
  const shouldReveal = streaming && !reduceMotion
  const [visibleText, setVisibleText] = useState('')

  useEffect(() => {
    if (!shouldReveal || !value) return undefined

    let index = 0
    const delay = Math.max(1, Number(revealMs) || 8)
    const resetTimer = window.setTimeout(() => setVisibleText(''), 0)
    const timer = window.setInterval(() => {
      index += 1
      setVisibleText(value.slice(0, index))
      if (index >= value.length) window.clearInterval(timer)
    }, delay)

    return () => {
      window.clearTimeout(resetTimer)
      window.clearInterval(timer)
    }
  }, [revealMs, shouldReveal, value])

  return <Component {...props}>{shouldReveal ? visibleText : value}</Component>
}

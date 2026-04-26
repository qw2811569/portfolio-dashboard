import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({
  value,
  as: Component = 'span',
  className = '',
  style = {},
  duration = 280,
  ...props
}) {
  const prevRef = useRef(value)
  const [transitioning, setTransitioning] = useState(false)
  const [prevValue, setPrevValue] = useState(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      setPrevValue(prevRef.current)
      prevRef.current = value
      setTransitioning(true)
      const timer = setTimeout(() => setTransitioning(false), duration)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [value, duration])

  return (
    <Component
      {...props}
      className={['animated-number', className].filter(Boolean).join(' ')}
      data-settling={transitioning ? 'true' : 'false'}
      data-prev-value={String(prevValue ?? '')}
      style={{
        display: 'inline-block',
        animation: transitioning ? `metric-settle ${duration}ms ease-out both` : 'none',
        ...style,
      }}
    >
      {value}
    </Component>
  )
}

export default function AnimatedNumber({
  value,
  as: Component = 'span',
  className = '',
  style = {},
  duration = 280,
  ...props
}) {
  return (
    <Component
      {...props}
      className={['animated-number', className].filter(Boolean).join(' ')}
      data-settling="true"
      style={{
        display: 'inline-block',
        animation: `metric-settle ${duration}ms ease-out both`,
        ...style,
      }}
    >
      {value}
    </Component>
  )
}

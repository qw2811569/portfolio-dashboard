export default function PanelMount({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component {...props} className={['panel-mount', className].filter(Boolean).join(' ')}>
      {children}
    </Component>
  )
}

import {
  createContext,
  createElement as h,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const OverlayContext = createContext({
  register: () => {},
  unregister: () => {},
  hasBlocking: () => false,
  isBlocking: false,
  modalDepth: 0,
})

export function OverlayProvider({ children }) {
  const [blockingIds, setBlockingIds] = useState(() => new Set())

  const register = useCallback((id) => {
    if (!id) return
    setBlockingIds((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
  }, [])

  const unregister = useCallback((id) => {
    if (!id) return
    setBlockingIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  const value = useMemo(() => {
    const modalDepth = blockingIds.size
    const isBlocking = modalDepth > 0
    return {
      register,
      unregister,
      hasBlocking: () => isBlocking,
      isBlocking,
      modalDepth,
    }
  }, [blockingIds, register, unregister])

  return h(OverlayContext.Provider, { value }, children)
}

export function useOverlay() {
  return useContext(OverlayContext)
}

export function useOverlayBlockingStyle() {
  const { isBlocking } = useOverlay()
  return isBlocking ? { visibility: 'hidden', pointerEvents: 'none' } : {}
}

export function OverlayPortal({
  children,
  kind = 'blocking',
  id,
  style = {},
  className,
  ...props
}) {
  const generatedId = useId()
  const overlayId = id || `overlay-${generatedId}`
  const { register, unregister } = useOverlay()
  const isBlocking = kind === 'blocking'

  useEffect(() => {
    if (!isBlocking) return undefined
    register(overlayId)
    return () => unregister(overlayId)
  }, [isBlocking, overlayId, register, unregister])

  if (typeof document === 'undefined' || !document.body) return null

  return createPortal(
    h(
      'div',
      {
        className,
        'data-overlay-kind': kind,
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: isBlocking ? 1200 : 1100,
          ...style,
        },
        ...props,
      },
      children
    ),
    document.body
  )
}

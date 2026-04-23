import { createElement as h, useState, useCallback, useEffect, useRef } from 'react'
import { C, alpha } from '../theme.js'

// Toast context
const toastListeners = []

export function addToast(message, type = 'info', duration = 5000) {
  const id = Date.now()
  toastListeners.forEach((listener) => listener({ id, message, type, duration }))
  return id
}

export function removeToast(id) {
  toastListeners.forEach((listener) => listener({ id, remove: true }))
}

export function useToast() {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  // Cleanup all pending timers on unmount
  useEffect(
    () => () => {
      timersRef.current.forEach((timerId) => clearTimeout(timerId))
      timersRef.current.clear()
    },
    []
  )

  const add = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type, duration }])

    if (duration > 0) {
      const timerId = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        timersRef.current.delete(id)
      }, duration)
      timersRef.current.set(id, timerId)
    }

    return id
  }, [])

  const remove = useCallback((id) => {
    const timerId = timersRef.current.get(id)
    if (timerId) {
      clearTimeout(timerId)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, add, remove }
}

export function ToastContainer({ toasts, remove }) {
  if (!toasts || toasts.length === 0) return null

  const getTypeStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: alpha(C.positive, '12'),
          border: alpha(C.positive, '40'),
          color: C.textSec,
        }
      case 'error':
        return { bg: C.downBg, border: alpha(C.down, '40'), color: C.textSec }
      case 'warning':
        return { bg: C.amberBg, border: alpha(C.amber, '40'), color: C.textSec }
      default:
        return { bg: alpha(C.ink, '10'), border: alpha(C.ink, '40'), color: C.textSec }
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      default:
        return 'ℹ'
    }
  }

  return h(
    'div',
    {
      style: {
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
    },
    toasts.map((toast) => {
      const styles = getTypeStyles(toast.type)
      return h(
        'div',
        {
          key: toast.id,
          style: {
            background: styles.bg,
            border: `1px solid ${styles.border}`,
            borderRadius: 8,
            padding: '12px 16px',
            minWidth: 300,
            maxWidth: 400,
            boxShadow: `0 16px 32px ${alpha(C.text, '24')}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'slideIn 0.3s ease-out',
          },
        },
        h('span', { style: { fontSize: 16, color: styles.color } }, getIcon(toast.type)),
        h(
          'span',
          { style: { fontSize: 14, color: C.text, flex: 1, lineHeight: 1.6 } },
          toast.message
        ),
        h(
          'button',
          {
            onClick: () => remove(toast.id),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              background: 'transparent',
              border: 'none',
              color: C.textMute,
              cursor: 'pointer',
              fontSize: 16,
              borderRadius: 999,
              flexShrink: 0,
            },
          },
          '×'
        )
      )
    })
  )
}

export default ToastContainer

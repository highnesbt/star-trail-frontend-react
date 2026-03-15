import { useState, useCallback, useRef } from 'react'

let _addToast = null

export function useToastProvider() {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((toast) => {
    const id = ++counterRef.current
    setToasts(prev => {
      const next = [...prev, { ...toast, id }]
      return next.slice(-3) // max 3 stacked
    })
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [removeToast])

  // Register globally so useToast() works anywhere
  _addToast = addToast

  return { toasts, removeToast }
}

export function useToast() {
  const toast = useCallback((msg, type = 'info', duration) => {
    _addToast?.({ message: msg, type, duration })
  }, [])
  return toast
}

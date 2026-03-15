import { useEffect, useRef } from 'react'
import { useToastProvider } from '../hooks/useToast'
import './ToastContainer.css'

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  status: '◆',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastProvider()

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function Toast({ toast, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.dataset.state = 'in'
  }, [])

  return (
    <div ref={ref} className={`toast toast--${toast.type || 'info'}`} data-state="in">
      <span className="toast__icon">{ICONS[toast.type] || ICONS.info}</span>
      <span className="toast__message">{toast.message}</span>
      <button className="toast__close" onClick={onClose}>×</button>
    </div>
  )
}

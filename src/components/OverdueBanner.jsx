import { useState } from 'react'
import './OverdueBanner.css'

const DISMISSED_KEY = 'st_overdue_dismissed'

export default function OverdueBanner({ projects }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === 'true')

  if (dismissed) return null

  const today = new Date().toISOString().split('T')[0]
  const overdue = projects.filter(p => {
    return p.posting_date < today &&
      !['posted', 'cancelled', 'partially_posted'].includes(p.status)
  })

  if (overdue.length === 0) return null

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="overdue-banner">
      <span className="overdue-banner__icon">⚠</span>
      <span className="overdue-banner__text">
        <strong>{overdue.length} project{overdue.length !== 1 ? 's' : ''}</strong> overdue — past posting date
      </span>
      <button className="overdue-banner__dismiss" onClick={handleDismiss}>Dismiss</button>
    </div>
  )
}

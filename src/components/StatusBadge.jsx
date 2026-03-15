import './StatusBadge.css'

const STATUS_CONFIG = {
  upcoming:                { label: 'Upcoming',          color: 'upcoming' },
  pending:                 { label: 'Pending',           color: 'pending' },
  pending_internal_review: { label: 'Internal Review',   color: 'pir' },
  internal_revision:       { label: 'Internal Revision', color: 'ir' },
  pending_client_review:   { label: 'Client Review',     color: 'pcr' },
  resubmit:                { label: 'Resubmit',          color: 'resubmit' },
  client_approved:         { label: 'Approved',          color: 'approved' },
  partially_posted:        { label: 'Partially Posted',  color: 'partial' },
  posted:                  { label: 'Posted',            color: 'posted' },
  cancelled:               { label: 'Cancelled',         color: 'cancelled' },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'upcoming' }
  return (
    <span
      className={`status-badge status-badge--${config.color} status-badge--${size}`}
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }

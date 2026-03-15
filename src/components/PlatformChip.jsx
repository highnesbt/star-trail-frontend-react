import { getPlatform } from '../utils/platforms'
import './PlatformChip.css'

export default function PlatformChip({ platform, posted = false, onClick, size = 22 }) {
  const p = getPlatform(platform)
  return (
    <button
      className={`platform-chip${posted ? ' platform-chip--posted' : ''}`}
      style={{ '--p-color': p.color, '--p-size': `${size}px` }}
      onClick={onClick}
      title={p.label}
      aria-label={`${p.label}${posted ? ' (posted)' : ''}`}
      type="button"
    >
      <span
        className="platform-chip__icon"
        dangerouslySetInnerHTML={{ __html: p.icon }}
      />
    </button>
  )
}


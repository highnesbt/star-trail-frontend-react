export default function Skeleton({ width, height = 16, radius = 8, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <div
      style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}
      aria-hidden="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={`${Math.floor(Math.random() * 40 + 40)}%`} height={14} />
      ))}
    </div>
  )
}

import './AssetIndicator.css'

export default function AssetIndicator({ hasVideo, hasThumbnail, videoUrl, thumbnailUrl }) {
  if (!hasVideo && !hasThumbnail) return null

  const handleClick = (e, url) => {
    e.stopPropagation()
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <span className="asset-indicators">
      {hasVideo && (
        <span
          className={`asset-chip asset-chip--video${videoUrl ? ' asset-chip--link' : ''}`}
          title={videoUrl ? 'Open video link' : 'Has video link'}
          onClick={videoUrl ? (e) => handleClick(e, videoUrl) : undefined}
        >🎬</span>
      )}
      {hasThumbnail && (
        <span
          className={`asset-chip asset-chip--thumb${thumbnailUrl ? ' asset-chip--link' : ''}`}
          title={thumbnailUrl ? 'Open thumbnail' : 'Has thumbnail'}
          onClick={thumbnailUrl ? (e) => handleClick(e, thumbnailUrl) : undefined}
        >🖼</span>
      )}
    </span>
  )
}

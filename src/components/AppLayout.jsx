import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useToast } from '../hooks/useToast'
import './AppLayout.css'

const NAV_ITEMS = [
  { to: '/projects',  icon: <GridIcon />,      label: 'Projects' },
  { to: '/calendar',  icon: <CalIcon />,       label: 'Calendar' },
  { to: '/clients',   icon: <ClientsIcon />,   label: 'Clients' },
  { to: '/changelog', icon: <ChangelogIcon />, label: 'Changelog' },
]

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}
function CalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function ClientsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function ChangelogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function InitialsAvatar({ user, size = 32 }) {
  const colors = ['#7C3AED','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4']
  const color = colors[(user?.id || 0) % colors.length]
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('') || user?.username?.[0]?.toUpperCase() || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size < 28 ? 11 : 13, fontWeight: 600, flexShrink: 0,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}

export { InitialsAvatar }

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileQuery = window.matchMedia('(max-width: 767px)')
  const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
  const [isMobile, setIsMobile] = useState(mobileQuery.matches)
  const [isTablet, setIsTablet] = useState(tabletQuery.matches)
  const { permission, subscribed, subscribe } = usePushNotifications()
  const toast = useToast()
  const [pushBannerDismissed, setPushBannerDismissed] = useState(
    () => localStorage.getItem('push_banner_dismissed') === '1'
  )

  const handleSubscribe = async () => {
    try {
      await subscribe()
      toast('Push notifications enabled', 'success')
    } catch (err) {
      toast(err.message || 'Could not enable push notifications', 'error')
    }
  }

  const handleDismissBanner = () => {
    setPushBannerDismissed(true)
    localStorage.setItem('push_banner_dismissed', '1')
  }

  useEffect(() => {
    const handler = () => {
      setIsMobile(mobileQuery.matches)
      setIsTablet(tabletQuery.matches)
    }
    mobileQuery.addEventListener('change', handler)
    tabletQuery.addEventListener('change', handler)
    return () => {
      mobileQuery.removeEventListener('change', handler)
      tabletQuery.removeEventListener('change', handler)
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeMobile = () => setMobileOpen(false)

  if (isMobile) {
    return (
      <div className="app-layout app-layout--mobile">
        <main className="app-main">
          <Outlet />
        </main>
        <nav className="bottom-nav">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <div className={`app-layout${isTablet ? ' app-layout--tablet' : ''}`}>
      {isTablet && mobileOpen && (
        <div className="sidebar-overlay" onClick={closeMobile} />
      )}

      <aside className={`sidebar${isTablet && !mobileOpen ? ' sidebar--hidden' : ''}`}>
        <div className="sidebar__logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 19L19 5M19 5H9M19 5V15" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Star Trail</span>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__nav-item${isActive ? ' active' : ''}`}
              onClick={isTablet ? closeMobile : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <InitialsAvatar user={user} size={30} />
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user?.first_name || user?.username}</span>
              <span className="sidebar__user-role">{user?.role}</span>
            </div>
          </div>
          <button
            className={`icon-btn bell-btn${subscribed ? ' bell-btn--subscribed' : ''}`}
            onClick={handleSubscribe}
            title={subscribed ? 'Push notifications on' : 'Enable push notifications'}
            aria-label={subscribed ? 'Push notifications enabled' : 'Enable push notifications'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              {subscribed && <circle cx="18" cy="5" r="4" fill="#10B981" stroke="none"/>}
            </svg>
          </button>
          <button className="sidebar__logout" onClick={handleLogout} title="Logout" aria-label="Logout">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <main className="app-main">
        {isTablet && (
          <div className="tablet-topbar">
            <button className="tablet-menu-btn" onClick={() => setMobileOpen(o => !o)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        )}
        {permission === 'default' && !pushBannerDismissed && (
          <div className="push-banner" role="banner">
            <span>Enable push notifications for status updates</span>
            <button className="push-banner__enable" onClick={handleSubscribe}>Enable</button>
            <button className="push-banner__dismiss" onClick={handleDismissBanner} aria-label="Dismiss notification banner">Later</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../context/ProjectsContext'
import { useClients } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import StatusBadge from '../components/StatusBadge'
import ProjectDetail from '../components/ProjectDetail'
import Skeleton from '../components/Skeleton'
import BulkCalendarWizard from '../components/BulkCalendarWizard'
import { getPlatform } from '../utils/platforms'
import './CalendarView.css'

const STATUS_DOTS = {
  upcoming: '#6B7280', pending: '#F59E0B', pending_internal_review: '#3B82F6',
  pending_client_review: '#8B5CF6', resubmit: '#EF4444', client_approved: '#10B981',
  partially_posted: '#06B6D4', posted: '#22C55E', cancelled: '#374151',
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDaysInMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const days = []

  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  for (let i = 0; i < startDow; i++) days.push(null)

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month - 1, d))
  }

  while (days.length % 7 !== 0) days.push(null)
  return days
}

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function QuickAddModal({ date, clients, onClose, onCreate }) {
  const [form, setForm] = useState({
    client_id: clients[0]?.id || '',
    description: '',
    posting_date: date,
    video_post_link: '',
    music_link: '',
    caption: '',
    platforms: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const client = clients.find(c => c.id === Number(form.client_id))
    if (client) setForm(f => ({ ...f, platforms: client.default_platforms || [] }))
  }, [form.client_id, clients])

  const togglePlatform = (pl) =>
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(pl)
        ? f.platforms.filter(p => p !== pl)
        : [...f.platforms, pl],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onCreate({ ...form, client_id: Number(form.client_id) })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const allPlatforms = ['instagram','youtube','facebook','linkedin','x','threads','whatsapp']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="quick-add-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
        <div className="quick-add-modal__header">
          <h3 id="quick-add-title">New Project — {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="quick-add-modal__form">
          <div className="form-field">
            <label>Client *</label>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project?" autoFocus />
          </div>
          <div className="form-field">
            <label>Music Link</label>
            <input type="url" value={form.music_link} onChange={e => setForm(f => ({ ...f, music_link: e.target.value }))} placeholder="Spotify, Apple Music, SoundCloud…" />
          </div>
          <div className="form-field">
            <label>Caption</label>
            <textarea rows={2} value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Post caption…" />
          </div>
          <div className="form-field">
            <label>Platforms</label>
            <div className="platform-selector">
              {allPlatforms.map(pl => (
                <button key={pl} type="button"
                  className={`platform-selector__btn${form.platforms.includes(pl) ? ' active' : ''}`}
                  style={{ '--p-color': getPlatform(pl).color }}
                  onClick={() => togglePlatform(pl)}
                  title={getPlatform(pl).label}
                  aria-label={getPlatform(pl).label}
                ><span dangerouslySetInnerHTML={{ __html: getPlatform(pl).icon }} style={{display:'contents'}} /></button>
              ))}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="quick-add-modal__footer">
            <button type="button" className="modal-btn modal-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CalendarView() {
  const { apiFetch, user } = useAuth()
  const { subscribeWsEvents } = useProjects()
  const { clients } = useClients()
  const toast = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [openProject, setOpenProject] = useState(null)
  const [quickAddDate, setQuickAddDate] = useState(null)
  const [showBulkWizard, setShowBulkWizard] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [dragOver, setDragOver] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [clientFilter, setClientFilter] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/projects/calendar?year=${year}&month=${month}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data)
    } catch { setEvents([]) }
    finally { setLoading(false) }
  }, [apiFetch, year, month])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Re-fetch calendar when any project changes via WebSocket
  useEffect(() => {
    return subscribeWsEvents((msg) => {
      if (['status_changed', 'project_updated', 'project_created', 'project_deleted'].includes(msg.type)) {
        fetchEvents()
      }
    })
  }, [subscribeWsEvents, fetchEvents])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const days = useMemo(() => getDaysInMonth(year, month), [year, month])

  const visibleEvents = useMemo(() =>
    clientFilter ? events.filter(e => String(e.client_id) === clientFilter) : events
  , [events, clientFilter])

  const byDate = useMemo(() => {
    const map = {}
    visibleEvents.forEach(e => {
      const k = e.posting_date
      if (!map[k]) map[k] = []
      map[k].push(e)
    })
    return map
  }, [visibleEvents])

  const todayStr = toISO(new Date())
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const agendaDays = useMemo(() => {
    const grouped = {}
    visibleEvents.forEach(ev => {
      if (!grouped[ev.posting_date]) grouped[ev.posting_date] = []
      grouped[ev.posting_date].push(ev)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, projects]) => ({ date, projects }))
  }, [visibleEvents])

  const formatAgendaDate = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short'
    })

  const handleCreate = useCallback(async (payload) => {
    const res = await apiFetch('/api/projects/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create project')
    }
    toast('Project created', 'success')
    fetchEvents()
  }, [apiFetch, toast, fetchEvents])

  const handleDblClick = (day) => {
    if (!day || clients.length === 0) return
    setQuickAddDate(toISO(day))
  }

  const handleDragStart = useCallback((e, ev) => {
    setDragging({ id: ev.id, fromDate: ev.posting_date })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(ev.id))
  }, [])

  const handleDrop = useCallback(async (e, toDate) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragging || dragging.fromDate === toDate) { setDragging(null); return }
    const { id } = dragging
    setDragging(null)
    // Optimistic update
    setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, posting_date: toDate } : ev))
    try {
      const res = await apiFetch(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ posting_date: toDate }),
      })
      if (!res.ok) throw new Error()
      toast('Date updated', 'success')
    } catch {
      toast('Failed to update date', 'error')
      fetchEvents() // revert on failure
    }
  }, [dragging, apiFetch, toast, fetchEvents])

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <h1 className="page-title">Calendar</h1>
        <div className="calendar-nav">
          <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
          <span className="cal-month-label">{monthNames[month - 1]} {year}</span>
          <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">›</button>
        </div>
        <select
          className="filter-select"
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          aria-label="Filter by client"
        >
          <option value="">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        {user?.role === 'manager' && (
          <button className="btn-primary" onClick={() => setShowBulkWizard(true)}>
            Batch Create
          </button>
        )}
      </div>

      <div className="calendar-grid-wrap">
        <div className="calendar-day-headers">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="cal-day-header">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="calendar-skeleton" aria-busy="true" aria-label="Loading calendar">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="cal-cell cal-cell--skeleton">
                <Skeleton width="80%" height={12} style={{ marginBottom: 6 }} />
                <Skeleton width="60%" height={10} />
              </div>
            ))}
          </div>
        ) : (
          <div className="calendar-grid">
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="cal-cell cal-cell--empty" />
              const dateStr = toISO(day)
              const dayEvents = byDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isDragOver = dragOver === dateStr

              return (
                <div
                  key={dateStr}
                  className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isDragOver ? ' cal-cell--drag-over' : ''}`}
                  onDoubleClick={() => handleDblClick(day)}
                  onDragOver={e => { e.preventDefault(); setDragOver(dateStr) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, dateStr)}
                >
                  <div className="cal-cell__num">{day.getDate()}</div>
                  <div className="cal-cell__events">
                    {dayEvents.map(ev => (
                      <button
                        key={ev.id}
                        className={`cal-pill${dragging?.id === ev.id ? ' cal-pill--dragging' : ''}`}
                        style={{ '--client-color': ev.client_color || '#7C3AED' }}
                        draggable
                        onDragStart={e => handleDragStart(e, ev)}
                        onDragEnd={() => setDragging(null)}
                        onClick={(e) => { e.stopPropagation(); setOpenProject(ev.id) }}
                        title={ev.description || ev.client_name}
                      >
                        <span className="cal-pill__stripe" />
                        <span
                          className="cal-pill__dot"
                          style={{ background: STATUS_DOTS[ev.status] || '#6B7280' }}
                        />
                        <span className="cal-pill__text">{ev.description || ev.client_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {isMobile && !loading && (
          <div className="calendar-agenda">
            {agendaDays.length === 0 ? (
              <div className="calendar-agenda__empty">No projects this month</div>
            ) : agendaDays.map(({ date, projects }) => (
              <div key={date} className="agenda-day">
                <div className={`agenda-date-label${date === todayStr ? ' agenda-date-label--today' : ''}`}>
                  {formatAgendaDate(date)}
                </div>
                <div className="agenda-day__projects">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      className="cal-pill agenda-pill"
                      style={{ '--client-color': p.client_color || '#7C3AED' }}
                      onClick={() => setOpenProject(p.id)}
                      title={p.description || p.client_name}
                    >
                      <span className="cal-pill__stripe" />
                      <span className="cal-pill__dot" style={{ background: STATUS_DOTS[p.status] || '#6B7280' }} />
                      <span className="cal-pill__text">{p.description || p.client_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openProject && (
        <ProjectDetail
          projectId={openProject}
          onClose={() => setOpenProject(null)}
          onUpdate={() => fetchEvents()}
        />
      )}

      {quickAddDate && (
        <QuickAddModal
          date={quickAddDate}
          clients={clients}
          onClose={() => setQuickAddDate(null)}
          onCreate={handleCreate}
        />
      )}

      {showBulkWizard && (
        <BulkCalendarWizard
          onClose={() => setShowBulkWizard(false)}
          onCreated={() => fetchEvents()}
        />
      )}
    </div>
  )
}

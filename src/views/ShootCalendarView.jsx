import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../context/ProjectsContext'
import { useClients, useUsers } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import Skeleton from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'
import '../views/CalendarView.css'
import './ShootCalendarView.css'

const STATUS_DOTS = {
  scheduled: '#F59E0B',
  completed: '#22C55E',
  cancelled: '#6B7280',
}
const STATUS_COLORS = {
  scheduled: '#F59E0B',
  completed: '#22C55E',
  cancelled: '#6B7280',
}
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getCalendarGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const cells = []
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  for (let i = startDow; i > 0; i--) {
    cells.push({ date: new Date(year, month - 1, 1 - i), inMonth: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month - 1, d), inMonth: true })
  }
  let next = 1
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month, next++), inMonth: false })
  }
  return cells
}

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

function timeInputValue(t) {
  return formatTime(t)
}

function computeDropTarget(cellEl, clientY) {
  const pills = Array.from(cellEl.querySelectorAll('.cal-pill'))
  for (let i = 0; i < pills.length; i++) {
    const rect = pills[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) {
      return { index: i, id: Number(pills[i].dataset.id), edge: 'top' }
    }
  }
  const last = pills[pills.length - 1]
  return { index: pills.length, id: last ? Number(last.dataset.id) : null, edge: 'bottom' }
}

function userLabel(u) {
  if (!u) return ''
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
  return name || u.username
}

function ShootModal({ mode, shoot, date, clients, users, readOnly, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    client_id: shoot?.client_id || clients[0]?.id || '',
    shoot_date: shoot?.shoot_date || date,
    start_time: timeInputValue(shoot?.start_time) || '10:00',
    end_time: timeInputValue(shoot?.end_time) || '',
    location: shoot?.location || '',
    assigned_to_id: shoot?.assigned_to?.id || '',
    notes: shoot?.notes || '',
    status: shoot?.status || 'scheduled',
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (readOnly) return
    setLoading(true)
    setError('')
    try {
      await onSave({
        client_id: Number(form.client_id),
        shoot_date: form.shoot_date,
        start_time: form.start_time || undefined,
        end_time: form.end_time || null,
        location: form.location,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        notes: form.notes,
        ...(mode === 'edit' ? { status: form.status } : {}),
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const titleDate = new Date((form.shoot_date || date) + 'T00:00:00')
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="quick-add-modal shoot-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="quick-add-modal__header">
          <h3>{mode === 'edit' ? 'Shoot' : 'New Shoot'} — {titleDate}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="quick-add-modal__form">
          <div className="form-field">
            <label>Client *</label>
            <select value={form.client_id} onChange={set('client_id')} required disabled={readOnly}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Date *</label>
            <input type="date" value={form.shoot_date} onChange={set('shoot_date')} required disabled={readOnly} />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Start</label>
              <input type="time" value={form.start_time} onChange={set('start_time')} disabled={readOnly} />
            </div>
            <div className="form-field">
              <label>End</label>
              <input type="time" value={form.end_time} onChange={set('end_time')} disabled={readOnly} />
            </div>
          </div>
          <div className="form-field">
            <label>Location</label>
            <input type="text" value={form.location} onChange={set('location')} placeholder="Studio, client office…" disabled={readOnly} autoFocus={!readOnly && mode === 'create'} />
          </div>
          <div className="form-field">
            <label>Assigned to</label>
            <select value={form.assigned_to_id} onChange={set('assigned_to_id')} disabled={readOnly}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{userLabel(u)} ({u.role})</option>)}
            </select>
          </div>
          {mode === 'edit' && (
            <div className="form-field">
              <label>Status</label>
              <div className="shoot-modal__status">
                {['scheduled', 'completed', 'cancelled'].map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`shoot-status-btn${form.status === s ? ' active' : ''}`}
                    style={{ '--status-color': STATUS_COLORS[s] }}
                    disabled={readOnly}
                    onClick={() => !readOnly && setForm(f => ({ ...f, status: s }))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-field">
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Brief, gear, call time…" disabled={readOnly} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="shoot-modal__footer">
            {mode === 'edit' && !readOnly ? (
              <button type="button" className="modal-btn modal-btn--danger" onClick={() => setConfirmDelete(true)}>Delete</button>
            ) : <span />}
            <div className="shoot-modal__footer-actions">
              <button type="button" className="modal-btn modal-btn--ghost" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
              {!readOnly && (
                <button type="submit" className="modal-btn modal-btn--primary" disabled={loading}>
                  {loading ? 'Saving…' : (mode === 'edit' ? 'Save' : 'Create')}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete this shoot?"
          message="It will be removed from the calendar."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await onDelete()
            setConfirmDelete(false)
            onClose()
          }}
        />
      )}
    </>
  )
}

export default function ShootCalendarView() {
  const { apiFetch, user } = useAuth()
  const { subscribeWsEvents } = useProjects()
  const { clients } = useClients()
  const { users } = useUsers()
  const toast = useToast()
  const isManager = user?.role === 'manager'
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [dragOver, setDragOver] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [clientFilter, setClientFilter] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const grid = getCalendarGrid(year, month)
      const from = toISO(grid[0].date)
      const to = toISO(grid[grid.length - 1].date)
      const res = await apiFetch(`/api/shoots/?date_from=${from}&date_to=${to}&limit=500`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch { setEvents([]) }
    finally { setLoading(false) }
  }, [apiFetch, year, month])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    return subscribeWsEvents((msg) => {
      if (['shoot_created', 'shoot_updated', 'shoot_deleted', 'shoots_reordered'].includes(msg.type)) {
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

  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])

  const visibleEvents = useMemo(() =>
    clientFilter ? events.filter(e => String(e.client_id) === clientFilter) : events
  , [events, clientFilter])

  const sortDayEvents = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || String(a.start_time).localeCompare(String(b.start_time))
    || a.id - b.id

  const byDate = useMemo(() => {
    const map = {}
    visibleEvents.forEach(e => {
      const k = e.shoot_date
      if (!map[k]) map[k] = []
      map[k].push(e)
    })
    Object.values(map).forEach(list => list.sort(sortDayEvents))
    return map
  }, [visibleEvents])

  const todayStr = toISO(new Date())
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const agendaDays = useMemo(() => {
    const grouped = {}
    visibleEvents.forEach(ev => {
      if (!grouped[ev.shoot_date]) grouped[ev.shoot_date] = []
      grouped[ev.shoot_date].push(ev)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, shoots]) => ({ date, shoots: shoots.slice().sort(sortDayEvents) }))
  }, [visibleEvents])

  const formatAgendaDate = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short'
    })

  const handleCreate = useCallback(async (payload) => {
    const res = await apiFetch('/api/shoots/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create shoot')
    }
    toast('Shoot scheduled', 'success')
    fetchEvents()
  }, [apiFetch, toast, fetchEvents])

  const handleUpdate = useCallback(async (id, payload) => {
    const res = await apiFetch(`/api/shoots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to update shoot')
    }
    toast('Shoot updated', 'success')
    fetchEvents()
  }, [apiFetch, toast, fetchEvents])

  const handleDelete = useCallback(async (id) => {
    const res = await apiFetch(`/api/shoots/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to delete shoot')
    }
    toast('Shoot deleted', 'success')
    fetchEvents()
  }, [apiFetch, toast, fetchEvents])

  const handleDblClick = (day) => {
    if (!isManager || !day || clients.length === 0) return
    setModal({ mode: 'create', date: toISO(day) })
  }

  const handleDragStart = useCallback((e, ev) => {
    if (!isManager) return
    setDragging({ id: ev.id, fromDate: ev.shoot_date })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(ev.id))
  }, [isManager])

  const changeDate = useCallback(async (id, toDate) => {
    setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, shoot_date: toDate } : ev))
    try {
      const res = await apiFetch(`/api/shoots/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ shoot_date: toDate }),
      })
      if (!res.ok) throw new Error()
      toast('Date updated', 'success')
    } catch {
      toast('Failed to update date', 'error')
      fetchEvents()
    }
  }, [apiFetch, toast, fetchEvents])

  const reorderToIndex = useCallback(async (dateStr, draggedId, insertIndex) => {
    const list = (byDate[dateStr] || []).slice()
    const fromIdx = list.findIndex(e => e.id === draggedId)
    if (fromIdx === -1) return
    let target = insertIndex
    if (fromIdx < target) target -= 1
    const [moved] = list.splice(fromIdx, 1)
    target = Math.max(0, Math.min(target, list.length))
    list.splice(target, 0, moved)
    const orderedIds = list.map(e => e.id)
    const currentIds = (byDate[dateStr] || []).map(e => e.id)
    if (orderedIds.join(',') === currentIds.join(',')) return
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
    setEvents(prev => prev.map(e => orderMap.has(e.id) ? { ...e, sort_order: orderMap.get(e.id) } : e))
    try {
      const res = await apiFetch('/api/shoots/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast('Failed to reorder', 'error')
      fetchEvents()
    }
  }, [byDate, apiFetch, toast, fetchEvents])

  const handleDrop = useCallback((e, toDate) => {
    const cellEl = e.currentTarget
    const clientY = e.clientY
    e.preventDefault()
    setDragOver(null)
    setDropTarget(null)
    const drag = dragging
    if (!drag) return
    setDragging(null)
    if (drag.fromDate === toDate) {
      const { index } = computeDropTarget(cellEl, clientY)
      reorderToIndex(toDate, drag.id, index)
    } else {
      changeDate(drag.id, toDate)
    }
  }, [dragging, reorderToIndex, changeDate])

  const pillClass = (ev) =>
    `cal-pill${ev.status === 'completed' ? ' cal-pill--completed' : ''}${ev.status === 'cancelled' ? ' cal-pill--cancelled' : ''}${dragging?.id === ev.id ? ' cal-pill--dragging' : ''}`

  const pillTitle = (ev) => {
    const range = ev.end_time
      ? `${formatTime(ev.start_time)}–${formatTime(ev.end_time)}`
      : formatTime(ev.start_time)
    return [range, ev.client_name, ev.location, ev.assigned_to ? userLabel(ev.assigned_to) : null, ev.notes]
      .filter(Boolean).join(' · ')
  }

  const renderPill = (ev, extraClass = '') => (
    <button
      key={ev.id}
      data-id={ev.id}
      className={`${pillClass(ev)} ${extraClass}`.trim()}
      style={{ '--client-color': ev.client_color || '#7C3AED' }}
      draggable={isManager}
      onDragStart={isManager ? e => handleDragStart(e, ev) : undefined}
      onDragEnd={() => { setDragging(null); setDropTarget(null); setDragOver(null) }}
      onClick={(e) => { e.stopPropagation(); setModal({ mode: 'edit', shoot: ev }) }}
      title={pillTitle(ev)}
    >
      <span className="cal-pill__stripe" />
      <span className="cal-pill__dot" style={{ background: STATUS_DOTS[ev.status] || '#6B7280' }} />
      <span className="cal-pill__time">{formatTime(ev.start_time)}</span>
      <span className="cal-pill__text">{ev.client_name}{ev.location ? ` · ${ev.location}` : ''}</span>
      {ev.client_logo && <img src={ev.client_logo} alt="" className="cal-pill__logo" />}
    </button>
  )

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <h1 className="page-title">Shoots</h1>
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
        {isManager && (
          <button className="btn-primary" onClick={() => setModal({ mode: 'create', date: todayStr })}>
            New Shoot
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
          <div className="calendar-skeleton" aria-busy="true" aria-label="Loading shoot calendar">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="cal-cell cal-cell--skeleton">
                <Skeleton width="80%" height={12} style={{ marginBottom: 6 }} />
                <Skeleton width="60%" height={10} />
              </div>
            ))}
          </div>
        ) : (
          <div className="calendar-grid">
            {grid.map(({ date: day, inMonth }) => {
              const dateStr = toISO(day)
              const dayEvents = byDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isDragOver = dragOver === dateStr

              return (
                <div
                  key={dateStr}
                  className={`cal-cell${inMonth ? '' : ' cal-cell--outside'}${isToday ? ' cal-cell--today' : ''}${isDragOver ? ' cal-cell--drag-over' : ''}`}
                  onDoubleClick={() => handleDblClick(day)}
                  onDragOver={isManager ? e => {
                    e.preventDefault()
                    setDragOver(dateStr)
                    if (dragging && dragging.fromDate === dateStr) {
                      setDropTarget(computeDropTarget(e.currentTarget, e.clientY))
                    }
                  } : undefined}
                  onDragLeave={isManager ? () => setDragOver(null) : undefined}
                  onDrop={isManager ? e => handleDrop(e, dateStr) : undefined}
                >
                  <div className="cal-cell__num">{day.getDate()}</div>
                  <div className="cal-cell__events">
                    {dayEvents.map(ev => renderPill(
                      ev,
                      dropTarget && dragging?.fromDate === dateStr && dropTarget.id === ev.id
                        ? (dropTarget.edge === 'top' ? 'cal-pill--drop-before' : 'cal-pill--drop-after')
                        : ''
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
              <div className="calendar-agenda__empty">No shoots this month</div>
            ) : agendaDays.map(({ date, shoots }) => (
              <div key={date} className="agenda-day">
                <div className={`agenda-date-label${date === todayStr ? ' agenda-date-label--today' : ''}`}>
                  {formatAgendaDate(date)}
                </div>
                <div className="agenda-day__projects">
                  {shoots.map(p => renderPill(p, 'agenda-pill'))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ShootModal
          mode={modal.mode}
          shoot={modal.shoot}
          date={modal.date || modal.shoot?.shoot_date}
          clients={clients}
          users={users}
          readOnly={!isManager}
          onClose={() => setModal(null)}
          onSave={(payload) => modal.mode === 'edit'
            ? handleUpdate(modal.shoot.id, payload)
            : handleCreate(payload)}
          onDelete={() => handleDelete(modal.shoot.id)}
        />
      )}
    </div>
  )
}

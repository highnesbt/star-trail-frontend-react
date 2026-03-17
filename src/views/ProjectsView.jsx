import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../context/ProjectsContext'
import { useClients } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import StatusBadge from '../components/StatusBadge'
import AssetIndicator from '../components/AssetIndicator'
import PlatformChip from '../components/PlatformChip'
import { getPlatform } from '../utils/platforms'
import { SkeletonRow } from '../components/Skeleton'
import ProjectDetail from '../components/ProjectDetail'
import OverdueBanner from '../components/OverdueBanner'
import BulkCalendarWizard from '../components/BulkCalendarWizard'
import '../components/ConfirmModal.css'
import './ProjectsView.css'

const VIEW_KEY = 'st_projects_view'

const VALID_TRANSITIONS = {
  upcoming:                ['pending', 'pending_internal_review'],
  pending:                 ['pending_internal_review'],
  pending_internal_review: ['pending_client_review', 'internal_revision'],
  internal_revision:       ['pending_internal_review'],
  pending_client_review:   ['client_approved', 'resubmit'],
  resubmit:                ['pending_internal_review', 'pending_client_review'],
  client_approved:         ['posted', 'pending_client_review', 'partially_posted'],
  partially_posted:        ['posted', 'client_approved'],
  posted:                  [],
  cancelled:               [],
}
const MANAGER_ONLY = ['client_approved', 'partially_posted', 'posted', 'cancelled']

function QuickStatusChanger({ project, isManager, onChanged }) {
  const { changeStatus } = useProjects()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  const allowed = (VALID_TRANSITIONS[project.status] || [])
    .filter(s => isManager || !MANAGER_ONLY.includes(s))

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (allowed.length === 0) return <StatusBadge status={project.status} />

  const handleSelect = async (e, status) => {
    e.stopPropagation()
    setSaving(true)
    setOpen(false)
    try { await changeStatus(project.id, status) } catch {}
    finally { setSaving(false); onChanged?.() }
  }

  return (
    <div className="quick-status" ref={ref}>
      <button
        className={`quick-status__trigger${saving ? ' quick-status__trigger--saving' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        title="Change status"
        disabled={saving}
      >
        <StatusBadge status={project.status} />
        <span className="quick-status__caret">{saving ? '…' : '▾'}</span>
      </button>
      {open && (
        <div className="quick-status__dropdown" onClick={e => e.stopPropagation()}>
          {allowed.map(s => (
            <button key={s} className="quick-status__option" onClick={(e) => handleSelect(e, s)}>
              <StatusBadge status={s} size="sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDayLabel(dateStr) {
  if (!dateStr) return 'No Date'
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  if (d.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(projects) {
  const groups = []
  let lastDate = null
  for (const p of projects) {
    const date = p.posting_date || ''
    if (date !== lastDate) {
      groups.push({ date, projects: [] })
      lastDate = date
    }
    groups[groups.length - 1].projects.push(p)
  }
  return groups
}

function TableView({ projects, onOpen, user }) {
  const sorted = [...projects].sort((a, b) => (a.posting_date || '').localeCompare(b.posting_date || ''))
  const groups = groupByDate(sorted)

  return (
    <div className="projects-table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Client</th>
            <th>Status</th>
            <th>Platforms</th>
            <th>Assets</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <>
              <tr key={`sep-${group.date}`} className="day-separator">
                <td colSpan="6">
                  <div className="day-separator__inner">
                    <span className="day-separator__line" />
                    <span className="day-separator__label">{formatDayLabel(group.date)}</span>
                    <span className="day-separator__line" />
                  </div>
                </td>
              </tr>
              {group.projects.map(p => (
                <tr key={p.id} className="project-row" onClick={() => onOpen(p)} style={{ '--client-color': p.client_color || '#7C3AED' }}>
                  <td>
                    <div className="project-row__desc">
                      <span className="project-row__stripe" />
                      <span className="project-row__text">{p.description || <em className="text-muted">No description</em>}</span>
                      {(p.revision_count > 1) && <span className="revision-badge">×{p.revision_count}</span>}
                    </div>
                  </td>
                  <td><span className="project-row__client">{p.client_name}</span></td>
                  <td>
                    <QuickStatusChanger project={p} isManager={user?.role === 'manager'} />
                  </td>
                  <td>
                    <div className="project-row__platforms">
                      {(p.platforms || []).map(pl => (
                        <PlatformChip key={pl} platform={pl} posted={p.platform_statuses?.[pl]} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <AssetIndicator
                      hasVideo={Boolean(p.video_post_link)}
                      hasThumbnail={Boolean(p.thumbnail_link)}
                      videoUrl={p.video_post_link}
                      thumbnailUrl={p.thumbnail_link}
                    />
                  </td>
                  <td><span className="project-row__date">{formatDate(p.posting_date)}</span></td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const KANBAN_COLS = [
  { status: 'upcoming',                label: 'Upcoming' },
  { status: 'pending',                 label: 'Pending' },
  { status: 'pending_internal_review', label: 'Internal Review' },
  { status: 'internal_revision',       label: 'Internal Revision' },
  { status: 'pending_client_review',   label: 'Client Review' },
  { status: 'resubmit',                label: 'Resubmit' },
  { status: 'client_approved',         label: 'Approved' },
  { status: 'partially_posted',        label: 'Partial' },
  { status: 'posted',                  label: 'Posted' },
]

function KanbanView({ projects, onOpen, user }) {
  return (
    <div className="kanban-board">
      {KANBAN_COLS.map(col => {
        const colProjects = projects.filter(p => p.status === col.status)
        return (
          <div key={col.status} className="kanban-col" role="region" aria-label={`${col.label} column`}>
            <div className="kanban-col__header">
              <StatusBadge status={col.status} />
              <span className="kanban-col__count">{colProjects.length}</span>
            </div>
            <div className="kanban-col__cards">
              {colProjects.map(p => (
                <div key={p.id} className="kanban-card" onClick={() => onOpen(p)} style={{ '--client-color': p.client_color || '#7C3AED' }}>
                  <div className="kanban-card__stripe" />
                  <div className="kanban-card__body">
                    <p className="kanban-card__desc">{p.description || 'No description'}</p>
                    <div className="kanban-card__meta">
                      <span className="kanban-card__client">{p.client_name}</span>
                      <span className="kanban-card__date">{formatDate(p.posting_date)}</span>
                    </div>
                    <div className="kanban-card__footer">
                      <QuickStatusChanger project={p} isManager={user?.role === 'manager'} />
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <AssetIndicator hasVideo={Boolean(p.video_post_link)} hasThumbnail={Boolean(p.thumbnail_link)} videoUrl={p.video_post_link} thumbnailUrl={p.thumbnail_link} />
                        {(p.revision_count > 1) && <span className="revision-badge">×{p.revision_count}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {colProjects.length === 0 && (
                <div className="kanban-col__empty">—</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CreateProjectModal({ clients, onClose, onCreate }) {
  const [form, setForm] = useState({
    client_id: clients[0]?.id || '',
    description: '',
    posting_date: new Date().toISOString().split('T')[0],
    video_post_link: '',
    thumbnail_link: '',
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

  const togglePlatform = (pl) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(pl) ? f.platforms.filter(p => p !== pl) : [...f.platforms, pl],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
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
      <div className="create-modal" onClick={e => e.stopPropagation()}>
        <div className="create-modal__header">
          <h2>New Project</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="create-modal__form">
          <div className="form-field">
            <label>Client *</label>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project?" />
          </div>
          <div className="form-field">
            <label>Posting Date *</label>
            <input type="date" value={form.posting_date} onChange={e => setForm(f => ({ ...f, posting_date: e.target.value }))} required />
          </div>
          <div className="form-field">
            <label>Video / Post Link</label>
            <input type="url" value={form.video_post_link} onChange={e => setForm(f => ({ ...f, video_post_link: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="form-field">
            <label>Thumbnail Link</label>
            <input type="url" value={form.thumbnail_link} onChange={e => setForm(f => ({ ...f, thumbnail_link: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="form-field">
            <label>Music Link</label>
            <input type="url" value={form.music_link} onChange={e => setForm(f => ({ ...f, music_link: e.target.value }))} placeholder="Spotify, Apple Music, SoundCloud…" />
          </div>
          <div className="form-field">
            <label>Caption</label>
            <textarea rows={3} value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Post caption / copy…" />
          </div>
          <div className="form-field">
            <label>Platforms</label>
            <div className="platform-selector">
              {allPlatforms.map(pl => (
                <button
                  key={pl}
                  type="button"
                  className={`platform-selector__btn${form.platforms.includes(pl) ? ' active' : ''}`}
                  style={{ '--p-color': getPlatform(pl).color }}
                  onClick={() => togglePlatform(pl)}
                  title={getPlatform(pl).label}
                  aria-label={getPlatform(pl).label}
                >
                  <span dangerouslySetInnerHTML={{ __html: getPlatform(pl).icon }} style={{display:'contents'}} />
                </button>
              ))}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="create-modal__footer">
            <button type="button" className="modal-btn modal-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getWeekRange(offset) {
  const today = new Date()
  const dow = today.getDay()
  const mondayDelta = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayDelta + offset * 7)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return { start: iso(monday), end: iso(sunday), monday, sunday }
}

function formatWeekLabel({ monday, sunday }) {
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

export default function ProjectsView() {
  const { user } = useAuth()
  const { projects, loading, error, createProject, fetch } = useProjects()
  const { clients } = useClients()
  const toast = useToast()
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [showCreate, setShowCreate] = useState(false)
  const [openProject, setOpenProject] = useState(null)
  const [showBulkWizard, setShowBulkWizard] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [dateMode, setDateMode] = useState('week') // 'week' | 'all'

  useEffect(() => { localStorage.setItem(VIEW_KEY, view) }, [view])

  const ACTIVE_STATUSES = new Set(['upcoming','pending','pending_internal_review','internal_revision','pending_client_review','resubmit','client_approved','partially_posted'])

  const weekRange = getWeekRange(weekOffset)

  const filtered = projects.filter(p => {
    const matchSearch = !search || 
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === '' || statusFilter === 'all'
      ? true
      : statusFilter === 'active'
        ? ACTIVE_STATUSES.has(p.status)
        : p.status === statusFilter
    const matchDate = dateMode === 'all' || (
      p.posting_date >= weekRange.start && p.posting_date <= weekRange.end
    )
    return matchSearch && matchStatus && matchDate
  })

  const handleCreate = async (payload) => {
    const created = await createProject(payload)
    toast('Project created', 'success')
    return created
  }

  const allStatuses = ['upcoming','pending','pending_internal_review','pending_client_review','resubmit','client_approved','partially_posted','posted','cancelled']

  return (
    <div className="projects-view">
      <OverdueBanner projects={projects} />
      
      <div className="projects-view__header">
        <h1 className="page-title">Projects</h1>
        <div className="projects-view__actions">
          <div className="week-nav">
            <button
              className="week-nav__arrow"
              onClick={() => { setDateMode('week'); setWeekOffset(o => o - 1) }}
              aria-label="Previous week"
              disabled={dateMode === 'all'}
            >‹</button>
            <span className="week-nav__label">{formatWeekLabel(weekRange)}</span>
            <button
              className="week-nav__arrow"
              onClick={() => { setDateMode('week'); setWeekOffset(o => o + 1) }}
              aria-label="Next week"
              disabled={dateMode === 'all'}
            >›</button>
            {(weekOffset !== 0 && dateMode === 'week') && (
              <button className="week-nav__chip" onClick={() => setWeekOffset(0)}>This week</button>
            )}
            <button
              className={`week-nav__chip${dateMode === 'all' ? ' active' : ''}`}
              onClick={() => setDateMode(m => m === 'all' ? 'week' : 'all')}
            >All</button>
          </div>

          <div className="search-box" role="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search projects..."
              aria-label="Search projects"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="active">Active (default)</option>
            <option value="all">All Statuses</option>
            {allStatuses.map(s => (
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
            ))}
          </select>

          <div className="view-toggle">
            <button className={`view-toggle__btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')} title="Table view" aria-label="Table view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button className={`view-toggle__btn${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')} title="Kanban view" aria-label="Kanban view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="14"/></svg>
            </button>
          </div>

          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Project
          </button>
          {user?.role === 'manager' && (
            <button className="btn-primary" onClick={() => setShowBulkWizard(true)}>
              Batch Create
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="projects-skeleton" aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No projects found.</p>
          {(search || statusFilter) && <button className="link-btn" onClick={() => { setSearch(''); setStatusFilter(''); setDateMode('week'); setWeekOffset(0) }}>Clear filters</button>}
        </div>
      ) : view === 'table' ? (
        <TableView projects={filtered} onOpen={setOpenProject} user={user} />
      ) : (
        <KanbanView projects={filtered} onOpen={setOpenProject} user={user} />
      )}

      {showCreate && clients.length > 0 && (
        <CreateProjectModal
          clients={clients}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {openProject && (
        <ProjectDetail
          projectId={openProject.id}
          onClose={() => setOpenProject(null)}
          onUpdate={() => {}}
        />
      )}

      {showBulkWizard && (
        <BulkCalendarWizard
          onClose={() => setShowBulkWizard(false)}
          onCreated={() => fetch()}
        />
      )}
    </div>
  )
}

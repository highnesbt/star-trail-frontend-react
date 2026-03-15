import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { InitialsAvatar } from '../components/AppLayout'
import ProjectDetail from '../components/ProjectDetail'
import Skeleton from '../components/Skeleton'
import './ChangelogView.css'

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatFieldChange(log) {
  const fieldLabels = {
    status: 'status',
    description: 'description',
    video_post_link: 'video link',
    thumbnail_link: 'thumbnail link',
    caption: 'caption',
    posting_date: 'posting date',
    platforms: 'platforms',
    platform_statuses: 'platform statuses',
    client: 'client',
  }
  const field = fieldLabels[log.field_name] || log.field_name
  if (log.field_name === 'status') {
    return <>changed <em>{log.project_description || `#${log.project_id}`}</em> status: <strong>{log.old_value}</strong> → <strong>{log.new_value}</strong></>
  }
  return <>updated <em>{field}</em> on <em>{log.project_description || `#${log.project_id}`}</em></>
}

function UserBlock({ block, currentUser, isToday, onProjectClick, onNoteChange }) {
  const isMe = block.user.id === currentUser?.id
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(block.manual_note?.note_text || '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  const handleSave = async () => {
    setSaving(true)
    await onNoteChange(block.user.id, block.manual_note?.id, noteDraft)
    setSaving(false)
    setEditingNote(false)
  }

  const handleDelete = async () => {
    if (!block.manual_note?.id) return
    setSaving(true)
    await onNoteChange(block.user.id, block.manual_note.id, null)
    setSaving(false)
    setEditingNote(false)
    setNoteDraft('')
  }

  return (
    <div className="changelog-user-block">
      <div className="changelog-user-header">
        <InitialsAvatar user={block.user} size={34} />
        <div className="changelog-user-info">
          <span className="changelog-user-name">
            {block.user.first_name} {block.user.last_name}
            {!block.user.first_name && <span>User #{block.user.id}</span>}
          </span>
          <span className="changelog-user-role">{block.user.role}</span>
        </div>
      </div>

      <div className="changelog-activity">
        {block.auto_activity.map(log => (
          <div key={log.id} className="changelog-entry">
            <span className="changelog-entry__time">{formatTime(log.timestamp)}</span>
            <span className="changelog-entry__text">
              {formatFieldChange(log)}
              {log.project_id && (
                <button
                  className="project-link-btn"
                  onClick={() => onProjectClick(log.project_id)}
                  title="Open project"
                >
                  ↗
                </button>
              )}
            </span>
          </div>
        ))}

        {block.auto_activity.length === 0 && !block.manual_note && (
          <p className="changelog-no-activity">No logged activity</p>
        )}
      </div>

      {/* Manual note */}
      <div className="changelog-note-area">
        {block.manual_note && !editingNote ? (
          <div className="changelog-manual-note">
            <span className="changelog-note-icon">📝</span>
            <p className="changelog-note-text">{block.manual_note.note_text}</p>
            {isMe && isToday && (
              <button
                className="changelog-note-edit-btn"
                onClick={() => { setEditingNote(true); setTimeout(() => textareaRef.current?.focus(), 50) }}
                title="Edit note"
              >✏</button>
            )}
          </div>
        ) : editingNote ? (
          <div className="changelog-note-editor">
            <textarea
              ref={textareaRef}
              className="note-textarea"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="Write your note for today..."
            />
            <div className="changelog-note-editor__actions">
              {block.manual_note?.id && (
                <button className="modal-btn modal-btn--danger" onClick={handleDelete} disabled={saving}>Delete</button>
              )}
              <button className="modal-btn modal-btn--ghost" onClick={() => setEditingNote(false)} disabled={saving}>Cancel</button>
              <button className="modal-btn modal-btn--primary" onClick={handleSave} disabled={saving || !noteDraft.trim()}>
                {saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        ) : isMe && isToday ? (
          <button
            className="changelog-add-note-btn"
            onClick={() => setEditingNote(true)}
          >
            + Add daily note
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function ChangelogView() {
  const { user, apiFetch } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')
  const [openProject, setOpenProject] = useState(null)

  const fetchChangelog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/changelog/?date=${date}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [apiFetch, date])

  useEffect(() => { fetchChangelog() }, [fetchChangelog])

  const stepDate = (delta) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  const isToday = date === new Date().toISOString().split('T')[0]

  const handleNoteChange = useCallback(async (userId, noteId, text) => {
    try {
      if (text === null && noteId) {
        await apiFetch(`/api/changelog/notes/${noteId}/`, { method: 'DELETE' })
      } else if (noteId) {
        await apiFetch(`/api/changelog/notes/${noteId}/`, {
          method: 'PUT',
          body: JSON.stringify({ note_text: text }),
        })
      } else {
        await apiFetch('/api/changelog/notes/', {
          method: 'POST',
          body: JSON.stringify({ note_text: text }),
        })
      }
      fetchChangelog()
    } catch {}
  }, [apiFetch, fetchChangelog])

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const allUsers = data.map(b => b.user)
  const filtered = filterUser ? data.filter(b => b.user.id === Number(filterUser)) : data

  return (
    <div className="changelog-view">
      <div className="changelog-header">
        <h1 className="page-title">Changelog</h1>
        <div className="changelog-controls">
          <div className="date-nav">
            <button className="cal-nav-btn" onClick={() => stepDate(-1)}>‹</button>
            <input
              type="date"
              className="date-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <button className="cal-nav-btn" onClick={() => stepDate(1)} disabled={isToday}>›</button>
          </div>
          {!isToday && (
            <button className="link-btn" onClick={() => setDate(new Date().toISOString().split('T')[0])}>
              Today
            </button>
          )}
          {allUsers.length > 1 && (
            <select className="filter-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">All Users</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name || ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="changelog-date-label">
        {formatDate(date)}
        {isToday && <span className="today-chip">Today</span>}
      </div>

      <div className="changelog-body">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="changelog-user-block">
              <div className="changelog-user-header">
                <Skeleton width={34} height={34} radius={17} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width={120} height={14} />
                  <Skeleton width={60} height={11} />
                </div>
              </div>
              <Skeleton width="80%" height={13} style={{ marginTop: 12 }} />
              <Skeleton width="60%" height={13} style={{ marginTop: 6 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="changelog-empty">
            <p>No activity on this day.</p>
          </div>
        ) : (
          filtered.map(block => (
            <UserBlock
              key={block.user.id}
              block={block}
              currentUser={user}
              isToday={isToday}
              onProjectClick={setOpenProject}
              onNoteChange={handleNoteChange}
            />
          ))
        )}
      </div>

      {openProject && (
        <ProjectDetail
          projectId={openProject}
          onClose={() => setOpenProject(null)}
        />
      )}
    </div>
  )
}

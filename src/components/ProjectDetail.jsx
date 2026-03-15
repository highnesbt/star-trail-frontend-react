import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../context/ProjectsContext'
import { useToast } from '../hooks/useToast'
import StatusBadge, { STATUS_CONFIG } from './StatusBadge'
import AssetIndicator from './AssetIndicator'
import PlatformChip from './PlatformChip'
import './ConfirmModal.css'
import './ProjectDetail.css'

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

// Context-aware transition labels (shown in dropdown)
const TRANSITION_LABELS = {
  pending_internal_review: {
    internal_revision:     'Request Internal Revision',
    pending_client_review: 'Send to Client Review',
  },
  pending_client_review: {
    resubmit:         'Request Revision',
    client_approved:  'Approve',
  },
}

const MANAGER_ONLY = ['client_approved', 'partially_posted', 'posted', 'cancelled']

function formatDateTime(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Inline editable field with auto-save
function EditableField({ label, value, onSave, type = 'text', multiline = false, placeholder = '' }) {
  const [draft, setDraft] = useState(value || '')
  const [state, setState] = useState('idle') // idle | saving | saved | error
  const timerRef = useRef(null)
  const fadeRef = useRef(null)

  useEffect(() => { setDraft(value || '') }, [value])

  const triggerSave = useCallback((val) => {
    clearTimeout(timerRef.current)
    clearTimeout(fadeRef.current)
    timerRef.current = setTimeout(async () => {
      if (val === (value || '')) return
      setState('saving')
      try {
        await onSave(val)
        setState('saved')
        fadeRef.current = setTimeout(() => setState('idle'), 2000)
      } catch {
        setState('error')
        fadeRef.current = setTimeout(() => setState('idle'), 3000)
      }
    }, 800)
  }, [onSave, value])

  const handleChange = (val) => {
    setDraft(val)
    triggerSave(val)
  }

  const Tag = multiline ? 'textarea' : 'input'

  return (
    <div className="editable-field">
      {label && (
        <label>
          {label}
          {state === 'saving' && <span className="save-pill save-pill--saving">Saving…</span>}
          {state === 'saved'  && <span className="save-pill save-pill--saved">✓ Saved</span>}
          {state === 'error'  && <span className="save-pill save-pill--error">Failed</span>}
        </label>
      )}
      {!label && state === 'saving' && <span className="save-pill save-pill--saving">Saving…</span>}
      {!label && state === 'saved'  && <span className="save-pill save-pill--saved">✓ Saved</span>}
      {!label && state === 'error'  && <span className="save-pill save-pill--error">Failed</span>}
      <Tag
        className={`editable-input${state === 'saving' ? ' editable-input--saving' : ''}`}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        rows={multiline ? 3 : undefined}
      />
    </div>
  )
}

export default function ProjectDetail({ projectId, onClose, onUpdate }) {
  const { user, apiFetch } = useAuth()
  const { subscribeProject } = useProjects()
  const toast = useToast()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [statusDropdown, setStatusDropdown] = useState(false)
  const [resubmitNote, setResubmitNote] = useState('')
  const [pendingStatus, setPendingStatus] = useState(null)
  const [generalNote, setGeneralNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const loadProject = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await apiFetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setProject(data)
    } catch { onClose() }
    finally { setLoading(false) }
  }, [projectId, apiFetch, onClose])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        if (!cancelled) setProject(data)
      } catch { if (!cancelled) onClose() }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [projectId, apiFetch, onClose])

  // Subscribe to real-time updates for this project
  useEffect(() => {
    return subscribeProject(projectId, (msg) => {
      // Re-fetch full project (with audit log, notes, etc.)
      loadProject(true)
      onUpdate?.()
    })
  }, [projectId, subscribeProject, loadProject, onUpdate])

  const updateField = useCallback(async (field, value) => {
    const res = await apiFetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
    const updated = await res.json()
    setProject(updated)
    onUpdate?.(updated)
  }, [projectId, apiFetch, onUpdate])

  const handleStatusChange = useCallback(async (newStatus, note = '') => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, note }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.detail || 'Status change failed', 'error')
        return
      }
      const updated = await res.json()
      setProject(updated)
      onUpdate?.(updated)
      toast(`Status → ${STATUS_CONFIG[newStatus]?.label || newStatus}`, 'status')
      setStatusDropdown(false)
      setPendingStatus(null)
      setResubmitNote('')
    } catch (e) {
      toast(e.message, 'error')
    }
  }, [projectId, apiFetch, toast, onUpdate])

  const handlePlatformToggle = useCallback(async (platform) => {
    if (!project) return
    const newStatuses = {
      ...project.platform_statuses,
      [platform]: !project.platform_statuses?.[platform],
    }
    await updateField('platform_statuses', newStatuses)
  }, [project, updateField])

  const submitGeneralNote = useCallback(async () => {
    if (!generalNote.trim()) return
    setSubmittingNote(true)
    try {
      const res = await apiFetch(`/api/projects/${projectId}/notes/`, {
        method: 'POST',
        body: JSON.stringify({ note_text: generalNote }),
      })
      if (!res.ok) throw new Error('Failed to add note')
      const newNote = await res.json()
      setProject(prev => prev ? { ...prev, general_notes: [...(prev.general_notes || []), newNote] } : prev)
      setGeneralNote('')
      toast('Note added', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSubmittingNote(false)
    }
  }, [generalNote, projectId, apiFetch, toast])

  const allowedTransitions = project ? (VALID_TRANSITIONS[project.status] || []) : []
  const canCancel = user?.role === 'manager' && !['posted', 'cancelled'].includes(project?.status)
  const allStatusOptions = [...allowedTransitions, ...(canCancel ? ['cancelled'] : [])]
    .filter(s => {
      if (MANAGER_ONLY.includes(s) && user?.role !== 'manager') return false
      return true
    })

  return (
    <>
      <div className="slideover-overlay" onClick={onClose} />
      <aside className="slideover">
        {loading ? (
          <div className="slideover__loading">
            <div className="spinner" />
          </div>
        ) : project ? (
          <>
            {/* Header */}
            <div className="slideover__header">
              <div className="slideover__header-left">
                <div className="slideover__client-stripe" style={{ background: project.client?.color || '#7C3AED' }} />
                <div>
                  <p className="slideover__client-name">{project.client?.name}</p>
                  <h2 className="slideover__title">{project.description || 'Untitled Project'}</h2>
                </div>
              </div>
              <button className="icon-btn slideover__close" onClick={onClose}>✕</button>
            </div>

            {/* Status bar */}
            <div className="slideover__status-bar">
              <div className="slideover__status-main">
                <StatusBadge status={project.status} size="md" />
                {project.revision_count > 1 && (
                  <span className="revision-badge">×{project.revision_count} revisions</span>
                )}
                <AssetIndicator hasVideo={Boolean(project.video_post_link)} hasThumbnail={Boolean(project.thumbnail_link)} />
              </div>
              {allStatusOptions.length > 0 && (
                <div className="status-change-area">
                  <button
                    className="btn-change-status"
                    onClick={() => setStatusDropdown(d => !d)}
                  >
                    Change Status ▾
                  </button>
                  {statusDropdown && (
                    <div className="status-dropdown">
                      {allStatusOptions.map(s => {
                          const contextLabel = TRANSITION_LABELS[project.status]?.[s]
                          return (
                            <button
                              key={s}
                              className={`status-dropdown__item${contextLabel ? ' status-dropdown__item--labeled' : ''}`}
                              onClick={() => {
                                if (s === 'resubmit' || s === 'internal_revision') {
                                  setPendingStatus(s)
                                  setStatusDropdown(false)
                                } else {
                                  handleStatusChange(s)
                                }
                              }}
                            >
                              {contextLabel
                                ? <><span className="status-dropdown__context-label">{contextLabel}</span><StatusBadge status={s} size="sm" /></>
                                : <StatusBadge status={s} />
                              }
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resubmit / Internal Revision note area */}
            {(pendingStatus === 'resubmit' || pendingStatus === 'internal_revision') && (
              <div className="resubmit-area">
                <p className="resubmit-area__label">
                  {pendingStatus === 'internal_revision' ? 'Internal revision note (optional)' : 'Revision note (optional)'}
                </p>
                <textarea
                  className="resubmit-textarea"
                  placeholder={pendingStatus === 'internal_revision' ? 'What needs to be reworked internally?' : 'What needs to be revised?'}
                  value={resubmitNote}
                  onChange={e => setResubmitNote(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <div className="resubmit-area__actions">
                  <button className="modal-btn modal-btn--ghost" onClick={() => setPendingStatus(null)}>Cancel</button>
                  <button
                    className="modal-btn modal-btn--danger"
                    onClick={() => handleStatusChange(pendingStatus, resubmitNote)}
                  >
                    {pendingStatus === 'internal_revision' ? 'Mark for Internal Revision' : 'Send for Revision'}
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="slideover__tabs">
              <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
              <button className={`tab-btn${tab === 'notes' ? ' active' : ''}`} onClick={() => setTab('notes')}>Notes</button>
            </div>

            {/* Tab content */}
            <div className="slideover__body">
              {tab === 'overview' && (
                <div className="slideover__overview">
                  <EditableField label="Description" value={project.description} onSave={v => updateField('description', v)} />
                  
                  <div className="detail-row">
                    <label>Posting Date</label>
                    <input
                      type="date"
                      className="editable-input"
                      defaultValue={project.posting_date}
                      onBlur={e => { if (e.target.value !== project.posting_date) updateField('posting_date', e.target.value) }}
                    />
                  </div>

                  {/* Video + Thumbnail links */}
                  <div className="asset-links">
                    <div className="asset-link-field">
                      <div className="asset-link-field__header">
                        <label>Video / Post Link</label>
                        {project.video_post_link && (
                          <a href={project.video_post_link} target="_blank" rel="noopener noreferrer" className="asset-open-btn">
                            Open ↗
                          </a>
                        )}
                      </div>
                      <EditableField value={project.video_post_link} onSave={v => updateField('video_post_link', v)} type="url" placeholder="Paste video / post URL…" />
                    </div>
                    <div className="asset-link-field">
                      <div className="asset-link-field__header">
                        <label>Thumbnail Link</label>
                        {project.thumbnail_link && (
                          <a href={project.thumbnail_link} target="_blank" rel="noopener noreferrer" className="asset-open-btn">
                            Open ↗
                          </a>
                        )}
                      </div>
                      <EditableField value={project.thumbnail_link} onSave={v => updateField('thumbnail_link', v)} type="url" placeholder="Paste thumbnail URL…" />
                    </div>
                    <div className="asset-link-field">
                      <div className="asset-link-field__header">
                        <label>Music Link</label>
                        {project.music_link && (
                          <a href={project.music_link} target="_blank" rel="noopener noreferrer" className="asset-open-btn">
                            Open ↗
                          </a>
                        )}
                      </div>
                      <EditableField value={project.music_link} onSave={v => updateField('music_link', v)} type="url" placeholder="Spotify, Apple Music, SoundCloud…" />
                    </div>
                  </div>

                  <EditableField label="Caption" value={project.caption} onSave={v => updateField('caption', v)} multiline />

                  {/* Platforms */}
                  <div className="detail-section">
                    <label className="detail-label">Platforms</label>
                    <div className="platform-status-list">
                      {(project.platforms || []).map(pl => (
                        <div key={pl} className="platform-status-row">
                          <PlatformChip platform={pl} posted={project.platform_statuses?.[pl]} onClick={() => handlePlatformToggle(pl)} />
                          <span className="platform-status-name">{pl}</span>
                          <span className={`platform-status-tag${project.platform_statuses?.[pl] ? ' posted' : ''}`}>
                            {project.platform_statuses?.[pl] ? 'Posted' : 'Pending'}
                          </span>
                        </div>
                      ))}
                      {(project.platforms || []).length === 0 && <p className="text-muted" style={{fontSize:13}}>No platforms assigned</p>}
                    </div>
                  </div>

                  {/* Audit log */}
                  {project.audit_logs && project.audit_logs.length > 0 && (
                    <div className="detail-section">
                      <label className="detail-label">Activity</label>
                      <div className="audit-log">
                        {project.audit_logs.slice(0, 10).map(log => (
                          <div key={log.id} className="audit-entry">
                            <span className="audit-entry__time">{formatDateTime(log.timestamp)}</span>
                            <span className="audit-entry__text">
                              <strong>{log.user?.first_name || log.user?.username || 'Someone'}</strong>{' '}
                              changed <em>{log.field_name}</em>
                              {log.old_value && <> from <code>{log.old_value}</code></>}
                              {log.new_value && <> to <code>{log.new_value}</code></>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'notes' && (
                <div className="slideover__notes">
                  {project.revision_notes && project.revision_notes.length > 0 && (
                    <div className="detail-section">
                      <label className="detail-label">Revision Notes</label>
                      {project.revision_notes.map(rn => (
                        <div key={rn.id} className="revision-note-card">
                          <div className="revision-note-header">
                            <span className="revision-note-num">Revision #{rn.revision_num}</span>
                            <span className="revision-note-meta">
                              {rn.author?.first_name || 'Manager'} · {formatDateTime(rn.created_at)}
                            </span>
                          </div>
                          {rn.note_text && <p className="revision-note-text">{rn.note_text}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="detail-section">
                    <label className="detail-label">General Notes</label>
                    {(project.general_notes || []).map(n => (
                      <div key={n.id} className="general-note-card">
                        <p className="general-note-text">{n.note_text}</p>
                        <span className="general-note-meta">
                          {n.author?.first_name || 'User'} · {formatDateTime(n.created_at)}
                        </span>
                      </div>
                    ))}
                    <div className="note-input-area">
                      <textarea
                        className="note-textarea"
                        placeholder="Add a note..."
                        value={generalNote}
                        onChange={e => setGeneralNote(e.target.value)}
                        rows={3}
                      />
                      <button
                        className="modal-btn modal-btn--primary"
                        onClick={submitGeneralNote}
                        disabled={submittingNote || !generalNote.trim()}
                        style={{ alignSelf: 'flex-end', marginTop: 8 }}
                      >
                        {submittingNote ? 'Adding…' : 'Add Note'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}

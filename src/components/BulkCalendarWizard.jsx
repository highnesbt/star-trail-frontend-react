import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPlatform } from '../utils/platforms'
import { useClients } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import './BulkCalendarWizard.css'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PATTERNS = [
  { value: 'all', label: 'All Days' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekends', label: 'Weekends (Sat–Sun)' },
  { value: 'specific_weekdays', label: 'Specific Weekdays' },
  { value: 'specific_dates', label: 'Specific Dates' },
  { value: 'every_n', label: 'Every N Days' },
]
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getDatesForPattern(year, month, pattern, selectedWeekdays, specificDates, everyN) {
  const dates = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    const mondayDow = dow === 0 ? 6 : dow - 1
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    if (pattern === 'all') {
      dates.push(dateStr)
    } else if (pattern === 'weekdays') {
      if (mondayDow < 5) dates.push(dateStr)
    } else if (pattern === 'weekends') {
      if (mondayDow >= 5) dates.push(dateStr)
    } else if (pattern === 'specific_weekdays') {
      if (selectedWeekdays.includes(mondayDow)) dates.push(dateStr)
    } else if (pattern === 'specific_dates') {
      if (specificDates.includes(dateStr)) dates.push(dateStr)
    } else if (pattern === 'every_n') {
      if ((d - 1) % Math.max(1, everyN) === 0) dates.push(dateStr)
    }
  }
  return dates
}

function getMiniCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const days = []
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function StepIndicator({ step }) {
  return (
    <div className="wizard-steps" role="list" aria-label="Wizard steps">
      {[1, 2, 3, 4].map(n => (
        <div key={n} className={`wizard-step${step === n ? ' active' : step > n ? ' done' : ''}`} role="listitem">
          <div className="wizard-step__circle" aria-current={step === n ? 'step' : undefined}>
            {step > n ? '✓' : n}
          </div>
          <span className="wizard-step__label">
            {n === 1 ? 'Client' : n === 2 ? 'Pattern' : n === 3 ? 'Details' : 'Confirm'}
          </span>
          {n < 4 && <div className="wizard-step__line" aria-hidden="true" />}
        </div>
      ))}
    </div>
  )
}

export default function BulkCalendarWizard({ onClose, onCreated }) {
  const { apiFetch, user } = useAuth()
  const { clients } = useClients()
  const toast = useToast()
  const isManager = user?.role === 'manager'

  const now = new Date()
  const firstFocusRef = useRef(null)
  const [step, setStep] = useState(1)

  // Step 1
  const [clientId, setClientId] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [existingCount, setExistingCount] = useState(0)
  const [existingLoading, setExistingLoading] = useState(false)

  // Step 2
  const [pattern, setPattern] = useState('weekdays')
  const [selectedWeekdays, setSelectedWeekdays] = useState([0,1,2,3,4])
  const [specificDates, setSpecificDates] = useState([])
  const [everyN, setEveryN] = useState(7)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Step 3
  const [platforms, setPlatforms] = useState([])
  const [postingTime, setPostingTime] = useState('18:00')
  const [descriptionTemplate, setDescriptionTemplate] = useState('')

  // Step 4
  const [creating, setCreating] = useState(false)

  const debounceRef = useRef(null)

  // Set default client
  useEffect(() => {
    if (clients.length > 0 && !clientId) {
      setClientId(String(clients[0].id))
    }
  }, [clients, clientId])

  // Focus trap on mount
  useEffect(() => {
    const el = firstFocusRef.current
    if (el) el.focus()
  }, [])

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch existing projects this month for this client
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    const fetchExisting = async () => {
      setExistingLoading(true)
      try {
        const res = await apiFetch(`/api/projects/?client_id=${clientId}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const items = Array.isArray(data) ? data : (data.items ?? [])
        const count = items.filter(p => {
          if (!p.posting_date) return false
          const d = new Date(p.posting_date + 'T00:00:00')
          return d.getFullYear() === year && d.getMonth() + 1 === month
        }).length
        if (!cancelled) setExistingCount(count)
      } catch {}
      finally { if (!cancelled) setExistingLoading(false) }
    }
    fetchExisting()
    return () => { cancelled = true }
  }, [clientId, year, month, apiFetch])

  const buildPayload = useCallback(() => ({
    client_id: Number(clientId),
    year, month, pattern,
    weekdays: selectedWeekdays,
    specific_dates: specificDates,
    every_n: everyN,
    posting_time: postingTime,
    platforms,
    description_template: descriptionTemplate,
  }), [clientId, year, month, pattern, selectedWeekdays, specificDates, everyN, postingTime, platforms, descriptionTemplate])

  const fetchPreview = useCallback(async (payload) => {
    setPreviewLoading(true)
    try {
      const res = await apiFetch('/api/projects/bulk-preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      } else {
        // fallback: compute client-side
        const dates = getDatesForPattern(payload.year, payload.month, payload.pattern, payload.weekdays || [], payload.specific_dates || [], payload.every_n || 7)
        setPreview({ created_count: dates.length, skipped_dates: [] })
      }
    } catch {
      const dates = getDatesForPattern(payload.year, payload.month, payload.pattern, payload.weekdays || [], payload.specific_dates || [], payload.every_n || 7)
      setPreview({ created_count: dates.length, skipped_dates: [] })
    } finally {
      setPreviewLoading(false)
    }
  }, [apiFetch])

  const triggerPreview = useCallback(() => {
    if (!clientId) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPreview(buildPayload()), 500)
  }, [clientId, buildPayload, fetchPreview])

  useEffect(() => {
    if (step === 2) triggerPreview()
  }, [step, pattern, selectedWeekdays, specificDates, everyN, triggerPreview])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const patternDates = useMemo(() =>
    getDatesForPattern(year, month, pattern, selectedWeekdays, specificDates, everyN),
    [year, month, pattern, selectedWeekdays, specificDates, everyN]
  )

  const skippedSet = useMemo(() => new Set(preview?.skipped_dates || []), [preview])
  const datesToCreate = useMemo(() => patternDates.filter(d => !skippedSet.has(d)), [patternDates, skippedSet])
  const skippedDates = useMemo(() => patternDates.filter(d => skippedSet.has(d)), [patternDates, skippedSet])

  const toggleWeekday = (idx) =>
    setSelectedWeekdays(w => w.includes(idx) ? w.filter(d => d !== idx) : [...w, idx])

  const toggleSpecificDate = (dateStr) =>
    setSpecificDates(d => d.includes(dateStr) ? d.filter(s => s !== dateStr) : [...d, dateStr])

  const togglePlatform = (pl) =>
    setPlatforms(p => p.includes(pl) ? p.filter(x => x !== pl) : [...p, pl])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await apiFetch('/api/projects/bulk-create', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.detail || 'Bulk create failed', 'error')
        return
      }
      const result = await res.json()
      const count = result.created_count ?? datesToCreate.length
      toast(`Created ${count} project${count !== 1 ? 's' : ''}`, 'success')
      onCreated?.()
      onClose()
    } catch (e) {
      toast(e.message || 'Failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  const miniCalDays = useMemo(() => getMiniCalendarDays(year, month), [year, month])
  const allPlatforms = ['instagram','youtube','facebook','linkedin','x','threads']

  if (!isManager) return null

  const selectedClient = clients.find(c => c.id === Number(clientId))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bulk-wizard"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-wizard-title"
      >
        <div className="bulk-wizard__header">
          <h2 id="bulk-wizard-title">Batch Create Projects</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close wizard">✕</button>
        </div>

        <StepIndicator step={step} />

        <div className="bulk-wizard__body">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="wizard-step-content">
              <div className="form-field">
                <label htmlFor="wizard-client">Client *</label>
                <select
                  id="wizard-client"
                  ref={firstFocusRef}
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                >
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-field">
                <label>Month</label>
                <div className="month-picker">
                  <select
                    value={month}
                    onChange={e => setMonth(Number(e.target.value))}
                    aria-label="Month"
                  >
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                  <input
                    type="number"
                    className="year-input"
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    min={2020}
                    max={2099}
                    aria-label="Year"
                  />
                </div>
              </div>

              {clientId && (
                <div className="wizard-hint">
                  {existingLoading
                    ? 'Checking existing projects…'
                    : existingCount > 0
                    ? `${existingCount} project${existingCount !== 1 ? 's' : ''} already exist this month for ${selectedClient?.name || 'this client'}`
                    : `No projects yet this month for ${selectedClient?.name || 'this client'}`
                  }
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="wizard-step-content">
              <div className="form-field">
                <label>Pattern</label>
                <div className="pattern-list" role="radiogroup" aria-label="Schedule pattern">
                  {PATTERNS.map(p => (
                    <label key={p.value} className="pattern-radio">
                      <input
                        type="radio"
                        name="pattern"
                        value={p.value}
                        checked={pattern === p.value}
                        onChange={() => setPattern(p.value)}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {pattern === 'specific_weekdays' && (
                <div className="form-field">
                  <label>Select Weekdays</label>
                  <div className="weekday-chips">
                    {WEEKDAY_LABELS.map((lbl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`weekday-chip${selectedWeekdays.includes(idx) ? ' active' : ''}`}
                        onClick={() => toggleWeekday(idx)}
                        aria-label={WEEKDAY_NAMES[idx]}
                        aria-pressed={selectedWeekdays.includes(idx)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {pattern === 'specific_dates' && (
                <div className="form-field">
                  <label>Select Dates</label>
                  <div className="mini-calendar">
                    <div className="mini-cal-headers" aria-hidden="true">
                      {WEEKDAY_LABELS.map((d, i) => (
                        <div key={i} className="mini-cal-header">{d}</div>
                      ))}
                    </div>
                    <div className="mini-cal-grid" role="grid" aria-label="Calendar date selector">
                      {miniCalDays.map((d, i) => {
                        if (!d) return <div key={`empty-${i}`} className="mini-cal-cell mini-cal-cell--empty" aria-hidden="true" />
                        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                        const selected = specificDates.includes(dateStr)
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            className={`mini-cal-cell${selected ? ' selected' : ''}`}
                            onClick={() => toggleSpecificDate(dateStr)}
                            aria-label={`${d} ${MONTH_NAMES[month-1]}`}
                            aria-pressed={selected}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {pattern === 'every_n' && (
                <div className="form-field">
                  <label htmlFor="every-n-input">Every N Days</label>
                  <input
                    id="every-n-input"
                    type="number"
                    value={everyN}
                    onChange={e => setEveryN(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={31}
                    className="every-n-input"
                  />
                </div>
              )}

              <div className="wizard-preview-bar" aria-live="polite">
                {previewLoading ? (
                  <span className="wizard-preview-loading">Computing…</span>
                ) : (
                  <>
                    <span className="wizard-preview-count">
                      Will create <strong>{preview ? (preview.created_count ?? datesToCreate.length) : datesToCreate.length}</strong> project{datesToCreate.length !== 1 ? 's' : ''}
                    </span>
                    {(preview?.skipped_dates?.length ?? 0) > 0 && (
                      <span className="wizard-preview-skipped">
                        {preview.skipped_dates.length} date{preview.skipped_dates.length !== 1 ? 's' : ''} will be skipped (already have projects)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="wizard-step-content">
              <div className="form-field">
                <label>Platforms</label>
                <div className="platform-selector">
                  {allPlatforms.map(pl => (
                    <button
                      key={pl}
                      type="button"
                      className={`platform-selector__btn${platforms.includes(pl) ? ' active' : ''}`}
                      style={{ '--p-color': getPlatform(pl).color }}
                      onClick={() => togglePlatform(pl)}
                      title={getPlatform(pl).label}
                      aria-label={getPlatform(pl).label}
                      aria-pressed={platforms.includes(pl)}
                    >
                      <span dangerouslySetInnerHTML={{ __html: getPlatform(pl).icon }} style={{display:'contents'}} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="wizard-time">Posting Time</label>
                <input
                  id="wizard-time"
                  type="time"
                  value={postingTime}
                  onChange={e => setPostingTime(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="wizard-desc">Description Template</label>
                <input
                  id="wizard-desc"
                  type="text"
                  value={descriptionTemplate}
                  onChange={e => setDescriptionTemplate(e.target.value)}
                  placeholder="e.g. {client} post for {date}"
                />
                <span className="form-hint">Use <code>{'{date}'}</code> and <code>{'{client}'}</code> as placeholders</span>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="wizard-step-content">
              <h3 className="wizard-confirm-title">
                Creating <strong>{datesToCreate.length}</strong> project{datesToCreate.length !== 1 ? 's' : ''} in {MONTH_NAMES[month-1]} {year}
              </h3>

              {datesToCreate.length > 0 && (
                <div className="form-field">
                  <label>Dates to Create</label>
                  <div className="preview-date-list">
                    {datesToCreate.map(d => (
                      <span key={d} className="preview-date-chip preview-date-chip--create">
                        <span className="preview-date-dot preview-date-dot--green" aria-hidden="true" />
                        {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {skippedDates.length > 0 && (
                <div className="form-field">
                  <label>Skipped (already have projects)</label>
                  <div className="preview-date-list">
                    {skippedDates.map(d => (
                      <span key={d} className="preview-date-chip preview-date-chip--skip">
                        <span className="preview-date-dot preview-date-dot--amber" aria-hidden="true" />
                        {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {datesToCreate.length === 0 && (
                <div className="wizard-hint wizard-hint--warn">
                  No new dates to create. All pattern dates already have projects, or the pattern matches no dates.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bulk-wizard__footer">
          {step > 1 && (
            <button className="modal-btn modal-btn--ghost" onClick={() => setStep(s => s - 1)}>
              ← Back
            </button>
          )}
          <button className="modal-btn modal-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          {step < 4 ? (
            <button
              className="modal-btn modal-btn--primary"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !clientId}
            >
              Next →
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              onClick={handleCreate}
              disabled={creating || datesToCreate.length === 0}
            >
              {creating ? 'Creating…' : `Create ${datesToCreate.length} Project${datesToCreate.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

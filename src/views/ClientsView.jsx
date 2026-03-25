import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useClients } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import Skeleton from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'
import './ClientsView.css'

import { getPlatform } from '../utils/platforms'

const PLATFORMS = ['instagram','youtube','facebook','linkedin','x','threads','whatsapp']

function ClientForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    brand: initial.brand || '',
    email: initial.email || '',
    phone: initial.phone || '',
    color: initial.color || '#7C3AED',
    notes: initial.notes || '',
    default_platforms: initial.default_platforms || [],
    default_post_time: initial.default_post_time || '18:00:00',
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(initial.logo || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const togglePlatform = (pl) =>
    setForm(f => ({
      ...f,
      default_platforms: f.default_platforms.includes(pl)
        ? f.default_platforms.filter(p => p !== pl)
        : [...f.default_platforms, pl],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSave(form, logoFile, logoPreview === null && initial.logo)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="client-form">
      <div className="form-field">
        <label>Name *</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Client name" />
      </div>
      <div className="form-field">
        <label>Brand</label>
        <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Brand name" />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@brand.com" />
        </div>
        <div className="form-field">
          <label>Phone</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Brand Color</label>
          <div className="color-field">
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
            <input type="text" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="#7C3AED" maxLength={7} style={{ flex: 1 }} />
          </div>
        </div>
        <div className="form-field">
          <label>Default Post Time</label>
          <input type="time" value={form.default_post_time?.slice(0, 5) || '18:00'} onChange={e => setForm(f => ({ ...f, default_post_time: e.target.value + ':00' }))} />
        </div>
      </div>
      <div className="form-field">
        <label>Default Platforms</label>
        <div className="platform-selector">
          {PLATFORMS.map(pl => (
            <button key={pl} type="button"
              className={`platform-selector__btn${form.default_platforms.includes(pl) ? ' active' : ''}`}
              style={{ '--p-color': getPlatform(pl).color }}
              onClick={() => togglePlatform(pl)}
              title={getPlatform(pl).label}
              aria-label={getPlatform(pl).label}
            ><span dangerouslySetInnerHTML={{ __html: getPlatform(pl).icon }} style={{display:'contents'}} /></button>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Internal notes..." />
      </div>
      <div className="form-field">
        <label>Logo</label>
        {logoPreview ? (
          <div className="logo-preview">
            <img src={logoPreview} alt="Logo preview" className="logo-preview__img" />
            <button type="button" className="logo-preview__remove" onClick={removeLogo}>✕</button>
          </div>
        ) : (
          <label className="logo-upload-btn">
            <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
            Upload Logo
          </label>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="client-form__actions">
        <button type="button" className="modal-btn modal-btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="modal-btn modal-btn--primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save Client'}
        </button>
      </div>
    </form>
  )
}

function ClientCard({ client, selected, onClick }) {
  const initials = client.name.slice(0, 2).toUpperCase()
  return (
    <div
      className={`client-card${selected ? ' client-card--selected' : ''}`}
      onClick={onClick}
      style={{ '--client-color': client.color }}
    >
      <div className="client-card__stripe" />
      <div className="client-card__avatar" style={{ background: client.color + '30', color: client.color }}>
        {initials}
      </div>
      <div className="client-card__info">
        <p className="client-card__name">{client.name}</p>
        <p className="client-card__brand">{client.brand || client.email || '—'}</p>
      </div>
      <span className="client-card__count">{client.project_count} projects</span>
    </div>
  )
}

export default function ClientsView() {
  const { user, apiFetch } = useAuth()
  const { clients, loading, refetch } = useClients()
  const toast = useToast()
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const isManager = user?.role === 'manager'

  const selectedClient = clients.find(c => c.id === selected)

  const uploadLogo = useCallback(async (clientId, logoFile) => {
    const fd = new FormData()
    fd.append('file', logoFile)
    await apiFetch(`/api/clients/${clientId}/logo`, { method: 'POST', body: fd })
  }, [apiFetch])

  const deleteLogo = useCallback(async (clientId) => {
    await apiFetch(`/api/clients/${clientId}/logo`, { method: 'DELETE' })
  }, [apiFetch])

  const handleCreate = useCallback(async (form, logoFile) => {
    const res = await apiFetch('/api/clients/', { method: 'POST', body: JSON.stringify(form) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed') }
    const created = await res.json()
    if (logoFile) await uploadLogo(created.id, logoFile)
    toast('Client created', 'success')
    setShowCreate(false)
    refetch()
  }, [apiFetch, toast, refetch, uploadLogo])

  const handleUpdate = useCallback(async (form, logoFile, removeLogo) => {
    const res = await apiFetch(`/api/clients/${selected}`, { method: 'PUT', body: JSON.stringify(form) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed') }
    if (logoFile) await uploadLogo(selected, logoFile)
    else if (removeLogo) await deleteLogo(selected)
    toast('Client updated', 'success')
    setEditing(false)
    refetch()
  }, [apiFetch, toast, refetch, selected, uploadLogo, deleteLogo])

  const handleDeactivate = useCallback(async () => {
    const res = await apiFetch(`/api/clients/${deactivateTarget}`, { method: 'DELETE' })
    if (!res.ok) { toast('Failed to deactivate', 'error'); return }
    toast('Client deactivated', 'success')
    setDeactivateTarget(null)
    if (selected === deactivateTarget) setSelected(null)
    refetch()
  }, [apiFetch, toast, deactivateTarget, selected, refetch])

  return (
    <div className="clients-view">
      <div className="clients-view__header">
        <h1 className="page-title">Clients</h1>
        {isManager && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Client</button>
        )}
      </div>

      <div className={`clients-layout${selected ? ' detail-open' : ''}`}>
        {/* List */}
        <div className="clients-list">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="client-card">
                <Skeleton width={40} height={40} radius={8} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="40%" height={12} />
                </div>
              </div>
            ))
          ) : clients.length === 0 ? (
            <p className="clients-empty">No clients yet.</p>
          ) : (
            clients.map(c => (
              <ClientCard
                key={c.id}
                client={c}
                selected={selected === c.id}
                onClick={() => { setSelected(c.id); setEditing(false) }}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className={`client-detail-panel${selected ? ' client-detail-panel--visible' : ''}`}>
          {selected && (
            <button className="client-detail-back" onClick={() => { setSelected(null); setEditing(false) }}>
              ← Back to Clients
            </button>
          )}
          {!selectedClient ? (
            <div className="client-detail-empty">
              <p>Select a client to view details</p>
            </div>
          ) : editing ? (
            <div className="client-detail-content">
              <div className="client-detail-header">
                <h2>Edit Client</h2>
                <button className="icon-btn" onClick={() => setEditing(false)}>✕</button>
              </div>
              <ClientForm initial={selectedClient} onSave={handleUpdate} onCancel={() => setEditing(false)} />
            </div>
          ) : (
            <div className="client-detail-content">
              <div className="client-detail-header">
                <div className="client-detail-title">
                  {selectedClient.logo ? (
                    <img src={selectedClient.logo} alt={selectedClient.name} className="client-detail-logo" />
                  ) : (
                    <div className="client-detail-avatar" style={{ background: selectedClient.color + '25', color: selectedClient.color }}>
                      {selectedClient.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2>{selectedClient.name}</h2>
                    {selectedClient.brand && <p className="client-detail-brand">{selectedClient.brand}</p>}
                  </div>
                </div>
                {isManager && (
                  <div className="client-detail-actions">
                    <button className="modal-btn modal-btn--ghost" onClick={() => setEditing(true)}>Edit</button>
                    <button className="modal-btn modal-btn--danger" onClick={() => setDeactivateTarget(selectedClient.id)}>Deactivate</button>
                  </div>
                )}
              </div>

              <div className="client-info-grid">
                <div className="client-info-item">
                  <label>Email</label>
                  <span>{selectedClient.email || '—'}</span>
                </div>
                <div className="client-info-item">
                  <label>Phone</label>
                  <span>{selectedClient.phone || '—'}</span>
                </div>
                <div className="client-info-item">
                  <label>Projects</label>
                  <span>{selectedClient.project_count}</span>
                </div>
                <div className="client-info-item">
                  <label>Default Post Time</label>
                  <span>{selectedClient.default_post_time?.slice(0, 5) || '—'}</span>
                </div>
              </div>

              {selectedClient.default_platforms?.length > 0 && (
                <div className="client-info-section">
                  <label>Default Platforms</label>
                  <div className="client-platforms">
                    {selectedClient.default_platforms.map(pl => (
                      <span key={pl} className="platform-tag">{pl}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedClient.notes && (
                <div className="client-info-section">
                  <label>Notes</label>
                  <p className="client-notes">{selectedClient.notes}</p>
                </div>
              )}

              <div className="client-color-row">
                <label>Brand Color</label>
                <div className="client-color-swatch" style={{ background: selectedClient.color }} />
                <span className="client-color-hex">{selectedClient.color}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="create-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-client-title">
            <div className="create-modal__header">
              <h2 id="create-client-title">New Client</h2>
              <button className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Close">✕</button>
            </div>
            <div className="create-modal__form">
              <ClientForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <ConfirmModal
          title="Deactivate Client"
          message="This client will be hidden from the app. Their projects will remain. You can reactivate them later."
          confirmLabel="Deactivate"
          danger
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  )
}

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export function useProjects() {
  const { apiFetch } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== ''))
      ).toString()
      const res = await apiFetch(`/api/projects/${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to load projects')
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : data.items ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  const createProject = useCallback(async (payload) => {
    const res = await apiFetch('/api/projects/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create project')
    }
    const created = await res.json()
    setProjects(prev => [created, ...prev])
    return created
  }, [apiFetch])

  const updateProject = useCallback(async (id, payload) => {
    const res = await apiFetch(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to update project')
    }
    const updated = await res.json()
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    return updated
  }, [apiFetch])

  const changeStatus = useCallback(async (id, status, note = '') => {
    const res = await apiFetch(`/api/projects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to change status')
    }
    const updated = await res.json()
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    return updated
  }, [apiFetch])

  const getProject = useCallback(async (id) => {
    const res = await apiFetch(`/api/projects/${id}`)
    if (!res.ok) throw new Error('Project not found')
    return res.json()
  }, [apiFetch])

  // Apply a WS update to local state
  const applyWsUpdate = useCallback((event) => {
    const { type, project } = event
    if (!project) return
    if (type === 'project_created') {
      setProjects(prev => {
        if (prev.find(p => p.id === project.id)) return prev
        return [project, ...prev]
      })
    } else if (type === 'project_updated' || type === 'status_changed') {
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...project } : p))
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { projects, loading, error, fetch, createProject, updateProject, changeStatus, getProject, applyWsUpdate, setProjects }
}

export function useClients() {
  const { apiFetch } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await apiFetch('/api/clients/')
      if (!res.ok) throw new Error('Failed to load clients')
      const data = await res.json()
      setClients(Array.isArray(data) ? data : data.items ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [apiFetch])

  useEffect(() => { fetch() }, [fetch])

  return { clients, loading, refetch: fetch }
}

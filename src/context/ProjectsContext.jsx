import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { useToast } from '../hooks/useToast'
import { useSound } from '../hooks/useSound'

const ProjectsContext = createContext(null)

export function ProjectsProvider({ children }) {
  const { apiFetch, getAccess } = useAuth()
  const toast = useToast()
  const sound = useSound()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Listeners registered by ProjectDetail (or any component) to hear about a specific project update
  const listenersRef = useRef(new Map()) // projectId → Set of callbacks

  const subscribeProject = useCallback((projectId, cb) => {
    if (!listenersRef.current.has(projectId)) {
      listenersRef.current.set(projectId, new Set())
    }
    listenersRef.current.get(projectId).add(cb)
    return () => listenersRef.current.get(projectId)?.delete(cb)
  }, [])

  const fetch = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
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

  // Global WS event listeners (any component can subscribe to all events)
  const globalListenersRef = useRef(new Set())

  const subscribeWsEvents = useCallback((cb) => {
    globalListenersRef.current.add(cb)
    return () => globalListenersRef.current.delete(cb)
  }, [])

  const toastRef = useRef(toast)
  const soundRef = useRef(sound)
  useEffect(() => { toastRef.current = toast }, [toast])
  useEffect(() => { soundRef.current = sound }, [sound])

  const handleWsMessage = useCallback((msg) => {
    const { type, project } = msg
    if (!project) return

    // Update the projects list silently
    if (type === 'project_created') {
      setProjects(prev => prev.find(p => p.id === project.id) ? prev : [project, ...prev])
    } else if (type === 'project_updated' || type === 'status_changed') {
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...project } : p))
    } else if (type === 'project_deleted') {
      setProjects(prev => prev.filter(p => p.id !== project.id))
    }

    // Notify per-project listeners (e.g. open ProjectDetail)
    listenersRef.current.get(project.id)?.forEach(cb => cb(msg))

    // Notify global listeners (e.g. CalendarView)
    globalListenersRef.current.forEach(cb => cb(msg))

    // Toast + sound only for status changes
    if (type === 'status_changed') {
      toastRef.current(
        `${project.description || 'Project'} → ${msg.new_status?.replace(/_/g, ' ') || project.status_display || project.status}`,
        'status',
        5000
      )
      soundRef.current.statusChange?.()
    }
  }, []) // no external deps — everything via refs

  useWebSocket({ getToken: getAccess, onMessage: handleWsMessage })

  useEffect(() => { fetch() }, [fetch])

  return (
    <ProjectsContext.Provider value={{
      projects, loading, error,
      fetch, createProject, updateProject, changeStatus, getProject,
      setProjects, subscribeProject, subscribeWsEvents,
    }}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider')
  return ctx
}

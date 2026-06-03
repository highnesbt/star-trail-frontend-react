import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

// NOTE: project state/actions live in context/ProjectsContext (single source of
// truth, shared WS connection). This module only exposes client data.

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

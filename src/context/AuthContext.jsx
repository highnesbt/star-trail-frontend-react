import { createContext, useContext, useState, useCallback, useRef } from 'react'

const AuthContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const ACCESS_KEY = 'st_access_token'
const REFRESH_KEY = 'st_refresh_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('st_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  const [isLoading, setIsLoading] = useState(false)
  const refreshPromiseRef = useRef(null)

  const getAccess = () => localStorage.getItem(ACCESS_KEY)
  const getRefresh = () => localStorage.getItem(REFRESH_KEY)

  const setTokens = (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  }

  const clearTokens = () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem('st_user')
  }

  /** Refresh access token — singleton promise to prevent concurrent refreshes */
  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current

    const promise = (async () => {
      const refresh = getRefresh()
      if (!refresh) throw new Error('No refresh token')
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) throw new Error('Refresh failed')
      const data = await res.json()
      setTokens(data.access, data.refresh)
      return data.access
    })()

    refreshPromiseRef.current = promise
    try {
      return await promise
    } finally {
      refreshPromiseRef.current = null
    }
  }, [])

  /** Core API fetch with auto-retry on 401 */
  const apiFetch = useCallback(async (path, options = {}) => {
    const doRequest = async (token) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      }
      return fetch(`${API_BASE}${path}`, { ...options, headers })
    }

    let res = await doRequest(getAccess())

    if (res.status === 401) {
      try {
        const newToken = await refreshAccessToken()
        res = await doRequest(newToken)
      } catch {
        clearTokens()
        setUser(null)
        throw new Error('Session expired')
      }
    }

    return res
  }, [refreshAccessToken])

  const login = useCallback(async (username, password) => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail
        const msg = Array.isArray(detail)
          ? detail.map(e => e.msg || JSON.stringify(e)).join(', ')
          : (typeof detail === 'string' ? detail : 'Invalid credentials')
        throw new Error(msg)
      }
      const data = await res.json()
      setTokens(data.access, data.refresh)

      // Fetch user profile
      const profileRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${data.access}` },
      })
      const profile = await profileRes.json()
      localStorage.setItem('st_user', JSON.stringify(profile))
      setUser(profile)
      return profile
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, apiFetch, getAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

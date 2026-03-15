import { useEffect, useRef, useCallback } from 'react'

const WS_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws')

/**
 * Connects to WS with JWT token. Reconnects automatically.
 * onMessage is stored in a ref — changing it never triggers reconnection.
 */
export function useWebSocket({ getToken, onMessage, enabled = true }) {
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const retryCountRef = useRef(0)
  const isMountedRef = useRef(true)
  const onMessageRef = useRef(onMessage)

  // Keep ref current without triggering reconnects
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (!enabled || !isMountedRef.current) return
    const token = getToken()
    if (!token) return

    // Close any existing connection before opening a new one
    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.onclose = null
      wsRef.current.close()
    }

    const ws = new WebSocket(`${WS_BASE}/ws/projects/?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => { retryCountRef.current = 0 }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {}
    }

    ws.onclose = () => {
      if (!isMountedRef.current) return
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
      retryCountRef.current += 1
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [enabled, getToken]) // onMessage intentionally excluded — use ref instead

  useEffect(() => {
    isMountedRef.current = true
    connect()
    return () => {
      isMountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on intentional close
        wsRef.current.close()
      }
    }
  }, [connect])

  const reconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current)
    retryCountRef.current = 0
    connect()
  }, [connect])

  return { reconnect }
}

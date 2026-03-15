import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const { apiFetch } = useAuth()
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [subscribed, setSubscribed] = useState(false)

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY is not set — push notifications cannot be enabled.')
      alert('Push notifications are not configured on this server yet.')
      return
    }

    const reg = await navigator.serviceWorker.register('/sw.js')
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result !== 'granted') return

    // Clear any existing subscription with a different key before subscribing
    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subJson = sub.toJSON()
    const p256dh = subJson.keys?.p256dh
    const auth = subJson.keys?.auth

    if (!p256dh || !auth) {
      await sub.unsubscribe()
      throw new Error('Browser did not provide encryption keys. Try a different browser.')
    }

    const res = await apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Server error ${res.status}`)
    }

    setSubscribed(true)
    localStorage.setItem('push_subscribed', '1')
  }

  const unsubscribe = async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await apiFetch('/api/push/unsubscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setSubscribed(false)
    localStorage.removeItem('push_subscribed')
  }

  useEffect(() => {
    // Verify the browser actually has an active subscription (localStorage can be stale)
    const check = async () => {
      if (!('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) { localStorage.removeItem('push_subscribed'); setSubscribed(false); return }
      const sub = await reg.pushManager.getSubscription()
      if (!sub) { localStorage.removeItem('push_subscribed'); setSubscribed(false); return }
      setSubscribed(true)
    }
    check()
  }, [])

  return { permission, subscribed, subscribe, unsubscribe }
}

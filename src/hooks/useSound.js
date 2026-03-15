import { useRef, useCallback, useEffect } from 'react'

const MUTE_KEY = 'st_sound_muted'

// Pre-warm AudioContext on first user gesture (browser policy requirement)
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}
if (typeof window !== 'undefined') {
  const warm = () => { getAudioCtx(); document.removeEventListener('click', warm) }
  document.addEventListener('click', warm, { once: true })
}

function playFile(path) {
  try {
    const a = new Audio(path)
    a.volume = 0.5
    a.play().catch(() => {}) // may fail if no file — silently ignore
  } catch {}
}

function playTone(freq = 440, type = 'sine', duration = 0.15, volume = 0.08) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}

export function useSound() {
  const mutedRef = useRef(localStorage.getItem(MUTE_KEY) === 'true')

  const statusChange = useCallback(() => {
    if (mutedRef.current) return
    // Try file first, synthesize as fallback
    playFile('/sounds/status-change.mp3')
    playTone(523, 'sine', 0.1, 0.07)
    setTimeout(() => playTone(659, 'sine', 0.15, 0.06), 80)
  }, [])

  const notification = useCallback(() => {
    if (mutedRef.current) return
    playFile('/sounds/notification.mp3')
    playTone(880, 'sine', 0.12, 0.05)
  }, [])

  const success = useCallback(() => {
    if (mutedRef.current) return
    playTone(523, 'triangle', 0.08)
    setTimeout(() => playTone(784, 'triangle', 0.12, 0.06), 100)
  }, [])

  const error = useCallback(() => {
    if (mutedRef.current) return
    playTone(220, 'sawtooth', 0.15, 0.05)
  }, [])

  const isMuted = useCallback(() => mutedRef.current, [])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    localStorage.setItem(MUTE_KEY, mutedRef.current)
    return mutedRef.current
  }, [])

  return { statusChange, notification, success, error, isMuted, toggleMute }
}

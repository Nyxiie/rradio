import type { NowPlaying, Station } from '../../types'
import { backoffDelay } from '../backoff'
import { allStations, findStation } from '../customStations'
import { connectListenMoe } from '../metadata/listenmoe'
import { startPolling } from '../metadata/poll'
import { settingsStore } from '../settings'
import { createStore } from '../store'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'reconnecting' | 'error'

export interface PlayerState {
  stationId: string | null
  status: PlayerStatus
  /** Human-readable problem; set for 'reconnecting' and 'error'. */
  message: string | null
  nowPlaying: NowPlaying | null
}

export const playerStore = createStore<PlayerState>({
  stationId: settingsStore.get().stationId,
  status: 'idle',
  message: null,
  nowPlaying: null,
})

const STALL_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 8

const audio = new Audio()
audio.preload = 'none'
audio.crossOrigin = null // plain playback needs no CORS

/** True while the user wants sound; used to tell a user pause from a network drop. */
let wantPlaying = false
let attempt = 0
let useFallback = false
let retryTimer: ReturnType<typeof setTimeout> | undefined
let stallTimer: ReturnType<typeof setTimeout> | undefined
let stopMetadata: (() => void) | undefined

// Volume is the product of the user volume and temporary multipliers (ducking, fades).
let duck = 1
let fade = 1

function applyVolume(): void {
  const { volume, muted } = settingsStore.get()
  audio.volume = Math.min(1, Math.max(0, volume * duck * fade))
  audio.muted = muted
}

export function currentStation(): Station | undefined {
  return findStation(playerStore.get().stationId)
}

function resolveUrl(station: Station): string {
  const { dataSaver } = settingsStore.get()
  if (dataSaver && station.dataSaverUrl) return station.dataSaverUrl
  if (station.fallbackUrl) {
    const unsupported = station.streamMime ? audio.canPlayType(station.streamMime) === '' : false
    if (unsupported || useFallback) return station.fallbackUrl
  }
  return station.streamUrl
}

function clearTimers(): void {
  if (retryTimer) clearTimeout(retryTimer)
  if (stallTimer) clearTimeout(stallTimer)
  retryTimer = stallTimer = undefined
}

// ---- metadata --------------------------------------------------------------

function startMetadata(station: Station): void {
  stopMetadata?.()
  stopMetadata = undefined
  const { dataSaver } = settingsStore.get()
  const art = !dataSaver
  const source = station.metadata
  const set = (np: NowPlaying | null) => {
    if (playerStore.get().stationId === station.id) playerStore.patch({ nowPlaying: np })
  }
  if (source.kind === 'listenmoe') {
    stopMetadata = connectListenMoe(source.gateway, set, { art })
  } else if (source.kind !== 'none') {
    stopMetadata = startPolling(source, set, { art, intervalMs: dataSaver ? 60_000 : 20_000 })
  }
}

function endMetadata(): void {
  stopMetadata?.()
  stopMetadata = undefined
}

// ---- playback --------------------------------------------------------------

function load(station: Station): void {
  clearTimers()
  audio.src = resolveUrl(station)
  playerStore.patch({ status: attempt > 0 ? 'reconnecting' : 'loading' })
  audio.play().catch((err: unknown) => {
    // AbortError happens when a new load interrupts play(); anything else is handled by 'error'.
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      wantPlaying = false
      playerStore.patch({ status: 'paused', message: 'Press play to start.' })
    }
  })
  armStallTimer()
}

function armStallTimer(): void {
  if (stallTimer) clearTimeout(stallTimer)
  stallTimer = setTimeout(() => {
    if (wantPlaying && audio.readyState < 3 && !audio.paused) handleFailure('The stream is not responding.')
  }, STALL_TIMEOUT_MS)
}

function handleFailure(reason: string): void {
  const station = currentStation()
  if (!wantPlaying || !station) return
  if (stallTimer) clearTimeout(stallTimer)
  attempt += 1
  if (attempt === 2 && station.fallbackUrl) useFallback = true
  if (attempt > MAX_ATTEMPTS) {
    wantPlaying = false
    audio.removeAttribute('src')
    audio.load()
    playerStore.patch({ status: 'error', message: `${reason} Check the connection or try another station.` })
    return
  }
  const delay = backoffDelay(attempt - 1)
  playerStore.patch({
    status: 'reconnecting',
    message: `${reason} Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${MAX_ATTEMPTS}).`,
  })
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    if (wantPlaying) load(station)
  }, delay)
}

audio.addEventListener('playing', () => {
  if (!wantPlaying) return
  attempt = 0
  if (stallTimer) clearTimeout(stallTimer)
  playerStore.patch({ status: 'playing', message: null })
})
audio.addEventListener('waiting', () => {
  if (wantPlaying && playerStore.get().status === 'playing') {
    playerStore.patch({ status: 'loading' })
    armStallTimer()
  }
})
audio.addEventListener('stalled', () => {
  if (wantPlaying) armStallTimer()
})
audio.addEventListener('error', () => {
  if (audio.getAttribute('src')) handleFailure('Lost the stream.')
})
audio.addEventListener('ended', () => {
  // A live stream should never end; treat it as a drop.
  handleFailure('The stream ended.')
})
audio.addEventListener('pause', () => {
  // Paused from outside (OS media controls, headphones): reflect it.
  if (wantPlaying && !retryTimer && audio.getAttribute('src')) {
    wantPlaying = false
    endMetadata()
    playerStore.patch({ status: 'paused', message: null })
  }
})

window.addEventListener('online', () => {
  if (wantPlaying && playerStore.get().status !== 'playing') {
    attempt = 0
    const station = currentStation()
    if (station) load(station)
  }
})

// ---- public API ------------------------------------------------------------

export function play(): void {
  let station = currentStation()
  if (!station) {
    station = allStations()[0]
    if (!station) return
    selectStation(station.id, false)
  }
  wantPlaying = true
  attempt = 0
  useFallback = false
  applyVolume()
  startMetadata(station)
  load(station)
}

export function pause(): void {
  wantPlaying = false
  clearTimers()
  endMetadata()
  audio.pause()
  // Drop the connection so a paused live stream does not buffer in the background.
  audio.removeAttribute('src')
  audio.load()
  playerStore.patch({ status: 'paused', message: null })
}

export function toggle(): void {
  const { status } = playerStore.get()
  if (wantPlaying || status === 'playing' || status === 'loading' || status === 'reconnecting') pause()
  else play()
}

export function selectStation(id: string, autoplay = true): void {
  if (!findStation(id)) return
  const wasWanted = wantPlaying
  clearTimers()
  endMetadata()
  attempt = 0
  useFallback = false
  settingsStore.patch({ stationId: id })
  playerStore.set({ stationId: id, status: wasWanted ? 'loading' : 'idle', message: null, nowPlaying: null })
  if (autoplay || wasWanted) play()
}

function step(delta: number): void {
  const list = allStations()
  if (!list.length) return
  const i = list.findIndex((s) => s.id === playerStore.get().stationId)
  const next = list[(i + delta + list.length) % list.length]
  selectStation(next.id, true)
}
export const next = () => step(1)
export const prev = () => step(-1)

export function isWanted(): boolean {
  return wantPlaying
}

/** Multiplier used by the pomodoro timer to lower music during breaks. */
export function setDuck(factor: number): void {
  duck = factor
  applyVolume()
}

/** Fades the music out over `ms`, then pauses and restores the volume. */
export function fadeOutAndPause(ms = 6000): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const stepFade = () => {
      const t = Math.min(1, (performance.now() - start) / ms)
      fade = 1 - t
      applyVolume()
      if (t < 1) requestAnimationFrame(stepFade)
      else {
        pause()
        fade = 1
        applyVolume()
        resolve()
      }
    }
    stepFade()
  })
}

// Keep the element in sync with settings (volume, mute, data saver).
let lastDataSaver = settingsStore.get().dataSaver
settingsStore.subscribe(() => {
  applyVolume()
  const { dataSaver } = settingsStore.get()
  if (dataSaver !== lastDataSaver) {
    lastDataSaver = dataSaver
    const station = currentStation()
    if (wantPlaying && station) {
      // Reconnect on the other bitrate and refresh metadata (cover art on/off).
      attempt = 0
      startMetadata(station)
      load(station)
    }
  }
})
applyVolume()

import { AMBIENT_LAYERS, ambientUrl, type AmbientId } from '../../config/ambient'
import { createStore, useStore } from '../store'
import { settingsStore } from '../settings'
import { getAudioContext } from './context'

/**
 * Ambient mixer: looping recording -> per-layer gain -> master gain -> speakers.
 * Each recording is fetched and decoded the first time its layer is switched on,
 * then kept in memory. Music plays through a plain <audio> element and is mixed
 * by the OS/browser, so third-party streams need no CORS headers.
 */

interface RunningLayer {
  source: AudioBufferSourceNode
  gain: GainNode
}

const ids = AMBIENT_LAYERS.map((l) => l.id)

// Which layers are switched on. Not persisted: browsers require a user gesture to start audio.
export const ambientOn = createStore<Record<AmbientId, boolean>>(
  Object.fromEntries(ids.map((id) => [id, false])) as Record<AmbientId, boolean>,
)
export const useAmbientOn = (id: AmbientId) => useStore(ambientOn, (s) => s[id])

let master: GainNode | null = null
const running = new Map<AmbientId, RunningLayer>()
const decoded = new Map<AmbientId, AudioBuffer>()
const loading = new Map<AmbientId, Promise<AudioBuffer | null>>()

/** Slider position to gain: squared for a perceptually even response. */
const curve = (v: number) => v * v

function ensureMaster(ctx: AudioContext): GainNode {
  if (!master) {
    master = ctx.createGain()
    master.gain.value = curve(settingsStore.get().ambientMaster)
    master.connect(ctx.destination)
  }
  return master
}

/** Fetch and decode one recording. Resolves to null on any failure; a failed load can be retried. */
function loadBuffer(ctx: AudioContext, id: AmbientId): Promise<AudioBuffer | null> {
  const cached = decoded.get(id)
  if (cached) return Promise.resolve(cached)
  let p = loading.get(id)
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(ambientUrl(id))
        if (!res.ok) return null
        const buf = await ctx.decodeAudioData(await res.arrayBuffer())
        decoded.set(id, buf)
        return buf
      } catch {
        return null
      } finally {
        loading.delete(id)
      }
    })()
    loading.set(id, p)
  }
  return p
}

function startLayer(id: AmbientId): void {
  if (running.has(id)) return
  const ctx = getAudioContext()
  const out = ensureMaster(ctx)
  void loadBuffer(ctx, id).then((buffer) => {
    // Switched off (or already started) while the file was loading.
    if (!ambientOn.get()[id] || running.has(id)) return
    if (!buffer) {
      ambientOn.patch({ [id]: false } as Partial<Record<AmbientId, boolean>>)
      return
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    source.connect(gain).connect(out)
    source.start()
    gain.gain.setTargetAtTime(curve(settingsStore.get().ambientVolume[id]), ctx.currentTime, 0.4)
    running.set(id, { source, gain })
  })
}

function stopLayer(id: AmbientId): void {
  const r = running.get(id)
  if (!r) return
  running.delete(id)
  r.gain.gain.setTargetAtTime(0, r.gain.context.currentTime, 0.15)
  setTimeout(() => {
    try {
      r.source.stop()
    } catch {
      // already stopped
    }
    r.source.disconnect()
    r.gain.disconnect()
  }, 800)
}

export function setAmbientOn(id: AmbientId, on: boolean): void {
  // Patch first: a failed load flips the layer back to off asynchronously.
  ambientOn.patch({ [id]: on } as Partial<Record<AmbientId, boolean>>)
  if (on) startLayer(id)
  else stopLayer(id)
}

export function toggleAmbient(id: AmbientId): void {
  setAmbientOn(id, !ambientOn.get()[id])
}

export function setAmbientVolume(id: AmbientId, value: number): void {
  settingsStore.set((s) => ({ ...s, ambientVolume: { ...s.ambientVolume, [id]: value } }))
  const r = running.get(id)
  if (r) r.gain.gain.setTargetAtTime(curve(value), r.gain.context.currentTime, 0.05)
}

export function setAmbientMaster(value: number): void {
  settingsStore.patch({ ambientMaster: value })
  if (master) master.gain.setTargetAtTime(curve(value), master.context.currentTime, 0.05)
}

export function stopAllAmbient(): void {
  for (const id of ids) if (ambientOn.get()[id]) setAmbientOn(id, false)
}

/** True while at least one layer is playing. */
export const useAmbientPlaying = () => useStore(ambientOn, (s) => ids.some((id) => s[id]))

// Layers that were on when the master pause was pressed, so play brings back the same mix.
let resumeSet: AmbientId[] = []

/** Master play/pause: pauses every active layer, or resumes the last mix (Rain if there was none). */
export function toggleAmbientPlayback(): void {
  const active = ids.filter((id) => ambientOn.get()[id])
  if (active.length > 0) {
    resumeSet = active
    stopAllAmbient()
  } else {
    const set = resumeSet.length > 0 ? resumeSet : (['rain'] as AmbientId[])
    for (const id of set) setAmbientOn(id, true)
  }
}

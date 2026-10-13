import { AMBIENT_LAYERS, type AmbientId } from '../../config/ambient'
import { createStore, useStore } from '../store'
import { settingsStore } from '../settings'
import { getAudioContext } from './context'
import { buildLayer, createNoiseBuffers, type Layer, type NoiseBuffers } from './synth'

/**
 * Ambient mixer: layers -> per-layer gain -> master gain -> speakers.
 * Music plays through a plain <audio> element and is mixed by the OS/browser,
 * so third-party streams need no CORS headers.
 */

interface RunningLayer {
  layer: Layer
  gain: GainNode
}

const ids = AMBIENT_LAYERS.map((l) => l.id)

// Which layers are switched on. Not persisted: browsers require a user gesture to start audio.
export const ambientOn = createStore<Record<AmbientId, boolean>>(
  Object.fromEntries(ids.map((id) => [id, false])) as Record<AmbientId, boolean>,
)
export const useAmbientOn = (id: AmbientId) => useStore(ambientOn, (s) => s[id])

let master: GainNode | null = null
let bufs: NoiseBuffers | null = null
const running = new Map<AmbientId, RunningLayer>()

/** Slider position to gain: squared for a perceptually even response. */
const curve = (v: number) => v * v

function ensureGraph(): { ctx: AudioContext; master: GainNode; bufs: NoiseBuffers } {
  const ctx = getAudioContext()
  if (!master) {
    master = ctx.createGain()
    master.gain.value = curve(settingsStore.get().ambientMaster)
    master.connect(ctx.destination)
  }
  if (!bufs) bufs = createNoiseBuffers(ctx)
  return { ctx, master, bufs }
}

function startLayer(id: AmbientId): void {
  if (running.has(id)) return
  const { ctx, master, bufs } = ensureGraph()
  const layer = buildLayer(ctx, bufs, id)
  const gain = ctx.createGain()
  gain.gain.value = 0
  layer.out.connect(gain).connect(master)
  gain.gain.setTargetAtTime(curve(settingsStore.get().ambientVolume[id]), ctx.currentTime, 0.15)
  running.set(id, { layer, gain })
}

function stopLayer(id: AmbientId): void {
  const r = running.get(id)
  if (!r || !master) return
  running.delete(id)
  const ctx = r.gain.context
  r.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
  setTimeout(() => {
    r.layer.stop()
    r.gain.disconnect()
  }, 500)
}

export function setAmbientOn(id: AmbientId, on: boolean): void {
  if (on) startLayer(id)
  else stopLayer(id)
  ambientOn.patch({ [id]: on } as Partial<Record<AmbientId, boolean>>)
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

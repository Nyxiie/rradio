import { AMBIENT_LAYERS, type AmbientId } from '../config/ambient'
import { loadJson, saveJson } from './storage'
import { createStore, useStore } from './store'

export type ThemePref = 'system' | 'light' | 'dark'
export type BreakMusic = 'keep' | 'lower' | 'pause'

export interface Settings {
  theme: ThemePref
  dataSaver: boolean
  volume: number
  muted: boolean
  stationId: string | null
  favourites: string[]
  ambientMaster: number
  /** Per-layer volume. Whether a layer is on is deliberately not persisted (autoplay policy). */
  ambientVolume: Record<AmbientId, number>
  pomodoro: {
    focus: number
    short: number
    long: number
    rounds: number
    breakMusic: BreakMusic
    chime: boolean
  }
}

const KEY = 'rradio:settings'

const defaults: Settings = {
  theme: 'system',
  dataSaver: false,
  volume: 0.8,
  muted: false,
  stationId: null,
  favourites: [],
  ambientMaster: 0.8,
  ambientVolume: Object.fromEntries(AMBIENT_LAYERS.map((l) => [l.id, 0.5])) as Record<AmbientId, number>,
  pomodoro: { focus: 25, short: 5, long: 15, rounds: 4, breakMusic: 'lower', chime: true },
}

function load(): Settings {
  const saved = loadJson<Partial<Settings>>(KEY) ?? {}
  return {
    ...defaults,
    ...saved,
    ambientVolume: { ...defaults.ambientVolume, ...(saved.ambientVolume ?? {}) },
    pomodoro: { ...defaults.pomodoro, ...(saved.pomodoro ?? {}) },
  }
}

export const settingsStore = createStore<Settings>(load())
settingsStore.subscribe(() => saveJson(KEY, settingsStore.get()))

export const useSettings = <S,>(selector: (s: Settings) => S) => useStore(settingsStore, selector)

export function toggleFavourite(id: string): void {
  settingsStore.set((s) => ({
    ...s,
    favourites: s.favourites.includes(id) ? s.favourites.filter((f) => f !== id) : [...s.favourites, id],
  }))
}

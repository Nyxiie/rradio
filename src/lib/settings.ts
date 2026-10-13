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

// Saved values are checked against the defaults' types so corrupt storage cannot break start-up.
const pick = <T,>(value: unknown, fallback: T, ok: (v: unknown) => boolean = (v) => typeof v === typeof fallback): T =>
  ok(value) ? (value as T) : fallback
const unit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
const intIn = (lo: number, hi: number) => (v: unknown) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi

function load(): Settings {
  const raw = loadJson<unknown>(KEY)
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const vol = (saved.ambientVolume && typeof saved.ambientVolume === 'object' ? saved.ambientVolume : {}) as Record<string, unknown>
  const pom = (saved.pomodoro && typeof saved.pomodoro === 'object' ? saved.pomodoro : {}) as Record<string, unknown>
  const d = defaults
  return {
    theme: pick(saved.theme, d.theme, (v) => v === 'system' || v === 'light' || v === 'dark'),
    dataSaver: pick(saved.dataSaver, d.dataSaver),
    volume: pick(saved.volume, d.volume, unit),
    muted: pick(saved.muted, d.muted),
    stationId: pick(saved.stationId, d.stationId, (v) => typeof v === 'string'),
    favourites: Array.isArray(saved.favourites)
      ? saved.favourites.filter((f): f is string => typeof f === 'string')
      : d.favourites,
    ambientMaster: pick(saved.ambientMaster, d.ambientMaster, unit),
    ambientVolume: Object.fromEntries(
      AMBIENT_LAYERS.map((l) => [l.id, pick(vol[l.id], d.ambientVolume[l.id], unit)]),
    ) as Record<AmbientId, number>,
    pomodoro: {
      focus: pick(pom.focus, d.pomodoro.focus, intIn(1, 180)),
      short: pick(pom.short, d.pomodoro.short, intIn(1, 180)),
      long: pick(pom.long, d.pomodoro.long, intIn(1, 180)),
      rounds: pick(pom.rounds, d.pomodoro.rounds, intIn(1, 12)),
      breakMusic: pick(pom.breakMusic, d.pomodoro.breakMusic, (v) => v === 'keep' || v === 'lower' || v === 'pause'),
      chime: pick(pom.chime, d.pomodoro.chime),
    },
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

import { STATIONS } from '../config/stations'
import type { Station } from '../types'
import { loadJson, saveJson } from './storage'
import { createStore, useStore } from './store'
import { settingsStore } from './settings'

const KEY = 'rradio:custom-stations'

function sanitize(raw: unknown): Station | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.name !== 'string' || typeof r.streamUrl !== 'string') return null
  if (!/^https?:\/\//i.test(r.streamUrl)) return null
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()) : []
  return {
    id: typeof r.id === 'string' && r.id.startsWith('custom-') ? r.id : newId(),
    name: r.name.trim().slice(0, 80) || 'Untitled station',
    tags: tags.length ? tags.map((t) => t.trim().slice(0, 30)) : ['Custom'],
    streamUrl: r.streamUrl.trim(),
    fallbackUrl: typeof r.fallbackUrl === 'string' && /^https?:\/\//i.test(r.fallbackUrl) ? r.fallbackUrl : undefined,
    metadata: { kind: 'none' },
    custom: true,
  }
}

function newId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const initial = (loadJson<unknown[]>(KEY) ?? []).map(sanitize).filter((s): s is Station => s !== null)
export const customStore = createStore<{ stations: Station[] }>({ stations: initial })
customStore.subscribe(() => saveJson(KEY, customStore.get().stations))

export const useCustomStations = () => useStore(customStore, (s) => s.stations)

export type CustomInput = Pick<Station, 'name' | 'streamUrl' | 'tags'> & { fallbackUrl?: string }

export function addCustomStation(input: CustomInput): Station {
  const station: Station = { ...input, id: newId(), metadata: { kind: 'none' }, custom: true }
  customStore.set((s) => ({ stations: [...s.stations, station] }))
  return station
}

export function updateCustomStation(id: string, input: CustomInput): void {
  customStore.set((s) => ({
    stations: s.stations.map((st) => (st.id === id ? { ...st, ...input } : st)),
  }))
}

export function deleteCustomStation(id: string): void {
  customStore.set((s) => ({ stations: s.stations.filter((st) => st.id !== id) }))
  settingsStore.set((s) => ({
    ...s,
    favourites: s.favourites.filter((f) => f !== id),
    stationId: s.stationId === id ? null : s.stationId,
  }))
}

export function allStations(): Station[] {
  return [...STATIONS, ...customStore.get().stations]
}

export function findStation(id: string | null): Station | undefined {
  return id ? allStations().find((s) => s.id === id) : undefined
}

// ---- JSON export / import -------------------------------------------------

interface ExportFile {
  app: 'rradio'
  version: 1
  stations: Station[]
  favourites: string[]
}

export function exportJson(): string {
  const custom = customStore.get().stations
  const ids = new Set(custom.map((s) => s.id))
  const data: ExportFile = {
    app: 'rradio',
    version: 1,
    stations: custom,
    // Favourites of built-in stations are included too so a backup restores fully.
    favourites: settingsStore.get().favourites.filter((f) => ids.has(f) || STATIONS.some((s) => s.id === f)),
  }
  return JSON.stringify(data, null, 2)
}

/** Merges a backup into the current state. Returns how many stations were added. */
export function importJson(text: string): number {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const file = parsed as Partial<ExportFile> | null
  if (!file || file.app !== 'rradio' || !Array.isArray(file.stations)) {
    throw new Error('That file is not an rradio export.')
  }
  const existing = customStore.get().stations
  const known = new Set(existing.map((s) => s.streamUrl))
  const added: Station[] = []
  const idMap = new Map<string, string>()
  for (const raw of file.stations) {
    const st = sanitize(raw)
    if (!st) continue
    const dup = existing.find((e) => e.streamUrl === st.streamUrl)
    if (dup || known.has(st.streamUrl)) {
      if (dup) idMap.set(st.id, dup.id)
      continue
    }
    known.add(st.streamUrl)
    // Keep the exported id unless it collides, so imported favourites still match.
    const collides = existing.some((e) => e.id === st.id) || added.some((a) => a.id === st.id)
    const original = st.id
    if (collides) st.id = newId()
    idMap.set(original, st.id)
    added.push(st)
  }
  if (added.length) customStore.set((s) => ({ stations: [...s.stations, ...added] }))
  if (Array.isArray(file.favourites)) {
    const favs = file.favourites
      .filter((f): f is string => typeof f === 'string')
      .map((f) => idMap.get(f) ?? f)
      .filter((f) => allStations().some((s) => s.id === f))
    settingsStore.set((s) => ({ ...s, favourites: [...new Set([...s.favourites, ...favs])] }))
  }
  return added.length
}

import { useMemo, useState } from 'react'
import { STATIONS } from '../config/stations'
import { deleteCustomStation, useCustomStations } from '../lib/customStations'
import { selectStation, toggle } from '../lib/player/engine'
import { usePlayer } from '../lib/player/usePlayer'
import { toggleFavourite, useSettings } from '../lib/settings'
import type { Station } from '../types'
import { PlusIcon, StarIcon } from './icons'
import { buttonClass, inputClass } from './ui'

const ALL = '__all'
const FAV = '__fav'

function Eq() {
  return (
    <span className="flex h-4 w-4 items-end gap-0.5" aria-hidden="true">
      {[0, 0.3, 0.15].map((d) => (
        <span key={d} className="eq-bar w-1 bg-accent" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  )
}

export default function StationList({
  onAdd,
  onEdit,
}: {
  onAdd: () => void
  onEdit: (station: Station) => void
}) {
  const custom = useCustomStations()
  const favourites = useSettings((s) => s.favourites)
  const activeId = usePlayer((s) => s.stationId)
  const status = usePlayer((s) => s.status)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState(ALL)

  const stations = useMemo(() => [...STATIONS, ...custom], [custom])
  const genres = useMemo(() => [...new Set(stations.flatMap((s) => s.tags))].sort(), [stations])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stations.filter((s) => {
      if (genre === FAV && !favourites.includes(s.id)) return false
      if (genre !== ALL && genre !== FAV && !s.tags.includes(genre)) return false
      if (!q) return true
      return [s.name, s.description ?? '', ...s.tags].some((t) => t.toLowerCase().includes(q))
    })
  }, [stations, query, genre, favourites])

  // Group by first tag, keeping built-in genres first and custom stations last.
  const groups = useMemo(() => {
    const map = new Map<string, Station[]>()
    for (const s of visible) {
      const key = s.tags[0] ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return [...map.entries()]
  }, [visible])

  const pick = (s: Station) => {
    if (s.id === activeId && (status === 'playing' || status === 'loading' || status === 'reconnecting')) toggle()
    else selectStation(s.id)
  }

  const chip = (value: string, label: string) => (
    <button
      key={value}
      onClick={() => setGenre(value)}
      aria-pressed={genre === value}
      className={`border-2 border-line px-2 py-0.5 text-xs ${genre === value ? 'bg-accent text-accent-fg' : 'bg-bg hover:bg-surface'}`}
    >
      {label}
    </button>
  )

  return (
    <section aria-label="Stations" className="flex min-h-0 flex-col max-lg:h-[60dvh]">
      <div className="mb-3 flex shrink-0 gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stations or genres"
          aria-label="Search stations"
          className={inputClass}
        />
        <button onClick={onAdd} className={`${buttonClass} flex shrink-0 items-center gap-1`}>
          <PlusIcon /> Add
        </button>
      </div>

      <div className="mb-4 flex shrink-0 flex-wrap gap-1.5">
        {chip(ALL, 'All')}
        {chip(FAV, '★ Favourites')}
        {genres.map((g) => chip(g, g))}
      </div>

      {visible.length === 0 && (
        <p className="border-2 border-dashed border-line p-4 text-sm text-muted">
          {genre === FAV ? 'No favourites yet. Tap the star on a station.' : 'No stations match your search.'}
        </p>
      )}

      <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto pb-2">
        {groups.map(([name, list]) => (
          <div key={name}>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">{name}</h3>
            <ul className="space-y-2">
              {list.map((s) => {
                const active = s.id === activeId
                const fav = favourites.includes(s.id)
                return (
                  <li
                    key={s.id}
                    className={`retro flex items-stretch ${active ? 'bg-accent text-accent-fg' : 'bg-surface'}`}
                  >
                    <button onClick={() => pick(s)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
                      <span className="flex size-4 items-center justify-center">
                        {active && status === 'playing' ? <Eq /> : <span aria-hidden="true">▸</span>}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{s.name}</span>
                        <span className={`block truncate text-xs ${active ? 'opacity-80' : 'text-muted'}`}>
                          {s.description ?? s.tags.join(' · ')}
                        </span>
                      </span>
                    </button>
                    {s.custom && (
                      <>
                        <button onClick={() => onEdit(s)} className="px-2 text-xs underline" aria-label={`Edit ${s.name}`}>
                          Edit
                        </button>
                        <button
                          onClick={() => confirm(`Delete "${s.name}"?`) && deleteCustomStation(s.id)}
                          className="px-2 text-xs underline"
                          aria-label={`Delete ${s.name}`}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleFavourite(s.id)}
                      className="px-3"
                      aria-pressed={fav}
                      aria-label={fav ? `Remove ${s.name} from favourites` : `Add ${s.name} to favourites`}
                    >
                      <StarIcon filled={fav} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

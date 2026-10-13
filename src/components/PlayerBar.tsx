import { findStation, useCustomStations } from '../lib/customStations'
import { next, prev, toggle } from '../lib/player/engine'
import { usePlayer } from '../lib/player/usePlayer'
import { settingsStore, useSettings } from '../lib/settings'
import { MuteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from './icons'

export default function PlayerBar() {
  const stationId = usePlayer((s) => s.stationId)
  const status = usePlayer((s) => s.status)
  const message = usePlayer((s) => s.message)
  const np = usePlayer((s) => s.nowPlaying)
  const volume = useSettings((s) => s.volume)
  const muted = useSettings((s) => s.muted)
  useCustomStations() // re-render when stations change
  const station = findStation(stationId)

  const busy = status === 'loading' || status === 'reconnecting'
  const active = status === 'playing' || busy

  let title = 'Pick a station'
  let sub = 'Press play to start'
  if (station) {
    title = np?.title ?? station.name
    sub = np ? [np.artist, station.name].filter(Boolean).join(' · ') : station.description ?? 'Live radio'
  }
  if (status === 'loading') sub = 'Connecting…'
  if ((status === 'reconnecting' || status === 'error' || message) && message) sub = message

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden border-2 border-line bg-bg text-lg">
          {np?.artUrl ? <img
              key={np.artUrl}
              src={np.artUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.style.display = 'none')}
              className="size-full object-cover"
            /> : <span aria-hidden="true">♪</span>}
        </div>

        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate text-sm font-bold">{title}</p>
          <p className={`truncate text-xs ${status === 'error' ? 'text-accent' : 'text-muted'}`}>{sub}</p>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2" onClick={prev} aria-label="Previous station" title="Previous (P)">
            <PrevIcon />
          </button>
          <button
            onClick={toggle}
            className="retro retro-press flex size-11 items-center justify-center bg-accent text-accent-fg"
            aria-label={active ? 'Pause' : 'Play'}
            title="Play / pause (Space)"
          >
            {active ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <button className="p-2" onClick={next} aria-label="Next station" title="Next (N)">
            <NextIcon />
          </button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            className="p-1"
            onClick={() => settingsStore.patch({ muted: !muted })}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title="Mute (M)"
          >
            {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => settingsStore.patch({ volume: Number(e.target.value), muted: false })}
            aria-label="Music volume"
            className="w-28"
          />
        </div>
      </div>
      {/* Mobile volume row */}
      <div className="flex items-center gap-2 px-4 pb-3 sm:hidden">
        <button className="p-1" onClick={() => settingsStore.patch({ muted: !muted })} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => settingsStore.patch({ volume: Number(e.target.value), muted: false })}
          aria-label="Music volume"
          className="w-full"
        />
      </div>
    </div>
  )
}

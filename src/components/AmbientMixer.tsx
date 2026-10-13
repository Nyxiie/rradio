import { AMBIENT_LAYERS } from '../config/ambient'
import {
  setAmbientMaster,
  setAmbientVolume,
  toggleAmbient,
  toggleAmbientPlayback,
  useAmbientOn,
  useAmbientPlaying,
} from '../lib/ambient/mixer'
import { useSettings } from '../lib/settings'
import { PauseIcon, PlayIcon } from './icons'
import { Panel } from './ui'

function Layer({ id, label, glyph }: { id: (typeof AMBIENT_LAYERS)[number]['id']; label: string; glyph: string }) {
  const on = useAmbientOn(id)
  const volume = useSettings((s) => s.ambientVolume[id])
  return (
    <div className={`border-2 border-line p-2 ${on ? 'bg-accent text-accent-fg' : 'bg-bg'}`}>
      <button
        onClick={() => toggleAmbient(id)}
        aria-pressed={on}
        className="flex w-full items-center gap-2 text-left text-xs font-bold uppercase tracking-wider"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {glyph}
        </span>
        {label}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setAmbientVolume(id, Number(e.target.value))}
        aria-label={`${label} volume`}
        className="mt-2 w-full"
      />
    </div>
  )
}

export default function AmbientMixer() {
  const master = useSettings((s) => s.ambientMaster)
  const playing = useAmbientPlaying()
  return (
    <Panel title="Ambient layers">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          onClick={toggleAmbientPlayback}
          aria-label={playing ? 'Pause ambient layers' : 'Play ambient layers'}
          title={playing ? 'Pause ambient layers' : 'Play ambient layers'}
          className={`retro retro-press flex size-8 shrink-0 items-center justify-center ${playing ? 'bg-accent text-accent-fg' : 'bg-bg'}`}
        >
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <label htmlFor="ambient-master" className="shrink-0 text-muted">
          Overall
        </label>
        <input
          id="ambient-master"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={master}
          onChange={(e) => setAmbientMaster(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {AMBIENT_LAYERS.map((l) => (
          <Layer key={l.id} {...l} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Generated live in your browser. Mix as many as you like over the music.</p>
    </Panel>
  )
}

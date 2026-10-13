import { useRef, useState } from 'react'
import { exportJson, importJson } from '../lib/customStations'
import { settingsStore, useSettings, type BreakMusic, type ThemePref } from '../lib/settings'
import { Modal, buttonClass, inputClass } from './ui'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}

function Minutes({ label, field }: { label: string; field: 'focus' | 'short' | 'long' | 'rounds' }) {
  const value = useSettings((s) => s.pomodoro[field])
  const max = field === 'rounds' ? 12 : 180
  return (
    <Row label={label}>
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.min(max, Math.max(1, Math.round(Number(e.target.value)) || 1))
          settingsStore.set((s) => ({ ...s, pomodoro: { ...s.pomodoro, [field]: n } }))
        }}
        className={`${inputClass} w-20 text-right`}
      />
    </Row>
  )
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const theme = useSettings((s) => s.theme)
  const dataSaver = useSettings((s) => s.dataSaver)
  const chime = useSettings((s) => s.pomodoro.chime)
  const breakMusic = useSettings((s) => s.pomodoro.breakMusic)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'rradio-stations.json'
    a.click()
    // Revoking straight away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 1_000_000) {
      setMsg('That file is too large to be an rradio export.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      const added = importJson(await file.text())
      setMsg(`Imported ${added} new station${added === 1 ? '' : 's'}.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import failed.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-4">
        <Row label="Theme">
          <select
            value={theme}
            onChange={(e) => settingsStore.patch({ theme: e.target.value as ThemePref })}
            className={`${inputClass} w-auto`}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
        <Row label="Data saver (lower bitrate, no cover art)">
          <input
            type="checkbox"
            checked={dataSaver}
            onChange={(e) => settingsStore.patch({ dataSaver: e.target.checked })}
            className="size-5 accent-[var(--accent)]"
          />
        </Row>

        <h3 className="border-t-2 border-line pt-4 text-xs font-bold uppercase tracking-widest">Pomodoro</h3>
        <Minutes label="Focus (min)" field="focus" />
        <Minutes label="Short break (min)" field="short" />
        <Minutes label="Long break (min)" field="long" />
        <Minutes label="Focus sessions per long break" field="rounds" />
        <Row label="Chime on phase change">
          <input
            type="checkbox"
            checked={chime}
            onChange={(e) => settingsStore.set((s) => ({ ...s, pomodoro: { ...s.pomodoro, chime: e.target.checked } }))}
            className="size-5 accent-[var(--accent)]"
          />
        </Row>
        <Row label="Music during breaks">
          <select
            value={breakMusic}
            onChange={(e) =>
              settingsStore.set((s) => ({ ...s, pomodoro: { ...s.pomodoro, breakMusic: e.target.value as BreakMusic } }))
            }
            className={`${inputClass} w-auto`}
          >
            <option value="keep">Keep playing</option>
            <option value="lower">Lower volume</option>
            <option value="pause">Pause</option>
          </select>
        </Row>

        <h3 className="border-t-2 border-line pt-4 text-xs font-bold uppercase tracking-widest">Your stations</h3>
        <p className="text-xs text-muted">
          Custom stations and favourites are stored only in this browser. Export a JSON file to back them up or move them
          to another device.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={download} className={buttonClass}>
            Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()} className={buttonClass}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        {msg && (
          <p role="status" className="text-xs">
            {msg}
          </p>
        )}
      </div>
    </Modal>
  )
}

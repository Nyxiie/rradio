import { useEffect, useState } from 'react'
import AddStation from './components/AddStation'
import AmbientMixer from './components/AmbientMixer'
import { CoffeeIcon, GearIcon, MoonIcon, SunIcon } from './components/icons'
import PlayerBar from './components/PlayerBar'
import Pomodoro, { usePomodoroRemaining } from './components/Pomodoro'
import Settings from './components/Settings'
import SleepTimer from './components/SleepTimer'
import StationList from './components/StationList'
import { formatTime } from './components/ui'
import { initMediaSession } from './lib/player/mediaSession'
import { next, prev, toggle } from './lib/player/engine'
import { usePomodoro } from './lib/pomodoro'
import { settingsStore, useSettings } from './lib/settings'
import type { Station } from './types'

initMediaSession()

function useTheme() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = theme
  }, [theme])
  return theme
}

/** Shows the countdown in the tab title while the pomodoro runs. */
function useTabTitle() {
  const running = usePomodoro((s) => s.running)
  const phase = usePomodoro((s) => s.phase)
  const remaining = usePomodoroRemaining()
  useEffect(() => {
    document.title = running ? `${formatTime(remaining)} ${phase === 'focus' ? 'focus' : 'break'} · rradio` : 'rradio'
  }, [running, remaining, phase])
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (e.key === ' ' && el?.tagName !== 'BUTTON') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'm' || e.key === 'M') {
        settingsStore.set((s) => ({ ...s, muted: !s.muted }))
      } else if (e.key === 'n' || e.key === 'N') next()
      else if (e.key === 'p' || e.key === 'P') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const theme = useTheme()
  const dataSaver = useSettings((s) => s.dataSaver)
  const [showSettings, setShowSettings] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Station | null>(null)
  useTabTitle()
  useShortcuts()

  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="mx-auto flex h-dvh max-w-6xl flex-col px-4 pb-[82px] pt-4">
      <header className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          rradio<span className="text-accent">.</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => settingsStore.patch({ dataSaver: !dataSaver })}
            aria-pressed={dataSaver}
            title="Data saver: lower bitrate, no cover art"
            className={`retro retro-press px-2 py-1 text-xs font-bold uppercase ${dataSaver ? 'bg-accent text-accent-fg' : 'bg-surface'}`}
          >
            Data saver
          </button>
          <a
            href="https://ko-fi.com/rradio"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support rradio on Ko-fi"
            title="Support rradio on Ko-fi"
            className="retro retro-press bg-surface p-1.5"
          >
            <CoffeeIcon />
          </a>
          <button
            onClick={() => settingsStore.patch({ theme: dark ? 'light' : 'dark' })}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="retro retro-press bg-surface p-1.5"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="retro retro-press bg-surface p-1.5"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-6 overflow-y-auto lg:grid-cols-[1fr_360px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <StationList
          onAdd={() => {
            setEditing(null)
            setAdding(true)
          }}
          onEdit={(s) => {
            setEditing(s)
            setAdding(true)
          }}
        />
        <div className="no-scrollbar min-h-0 space-y-4 lg:overflow-y-auto lg:pb-2">
          <AmbientMixer />
          <Pomodoro />
          <SleepTimer />
        </div>
      </main>

      <PlayerBar />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {adding && (
        <AddStation
          key={editing?.id ?? 'new'}
          editing={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

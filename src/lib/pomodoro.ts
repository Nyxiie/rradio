import { playChime } from './chime'
import { isWanted, pause, play, setDuck } from './player/engine'
import { settingsStore } from './settings'
import { createStore, useStore } from './store'

export type PomodoroPhase = 'focus' | 'short' | 'long'

export interface PomodoroState {
  phase: PomodoroPhase
  running: boolean
  /** ms epoch the phase ends; only meaningful while running. */
  endsAt: number
  /** ms left while paused/idle. */
  remainingMs: number
  /** Focus sessions finished in this cycle. */
  completed: number
  /** True once the user has started the current phase (so setting changes do not reset it). */
  touched: boolean
}

const MIN = 60_000

export function phaseMs(phase: PomodoroPhase): number {
  const p = settingsStore.get().pomodoro
  return (phase === 'focus' ? p.focus : phase === 'short' ? p.short : p.long) * MIN
}

export const pomodoroStore = createStore<PomodoroState>({
  phase: 'focus',
  running: false,
  endsAt: 0,
  remainingMs: phaseMs('focus'),
  completed: 0,
  touched: false,
})
export const usePomodoro = <S,>(selector: (s: PomodoroState) => S) => useStore(pomodoroStore, selector)

let pausedByPomodoro = false

function applyMusicPolicy(phase: PomodoroPhase): void {
  const { breakMusic } = settingsStore.get().pomodoro
  if (phase === 'focus') {
    setDuck(1)
    if (pausedByPomodoro) {
      pausedByPomodoro = false
      play()
    }
    return
  }
  if (breakMusic === 'lower') setDuck(0.3)
  else if (breakMusic === 'pause' && isWanted()) {
    pausedByPomodoro = true
    pause()
  }
}

function enterPhase(phase: PomodoroPhase, completed: number, running: boolean): void {
  const ms = phaseMs(phase)
  pomodoroStore.set({ phase, running, endsAt: running ? Date.now() + ms : 0, remainingMs: ms, completed, touched: running })
  if (running) applyMusicPolicy(phase)
}

function advance(): void {
  const s = pomodoroStore.get()
  if (settingsStore.get().pomodoro.chime) playChime()
  if (s.phase === 'focus') {
    const completed = s.completed + 1
    const long = completed % settingsStore.get().pomodoro.rounds === 0
    enterPhase(long ? 'long' : 'short', completed, true)
  } else {
    enterPhase('focus', s.completed, true)
  }
}

export function startPomodoro(): void {
  const s = pomodoroStore.get()
  if (s.running) return
  pomodoroStore.patch({ running: true, endsAt: Date.now() + s.remainingMs, touched: true })
  applyMusicPolicy(s.phase)
}

export function pausePomodoro(): void {
  const s = pomodoroStore.get()
  if (!s.running) return
  pomodoroStore.patch({ running: false, remainingMs: Math.max(0, s.endsAt - Date.now()) })
}

export function resetPomodoro(): void {
  setDuck(1)
  pausedByPomodoro = false
  enterPhase('focus', 0, false)
}

export function skipPhase(): void {
  const s = pomodoroStore.get()
  if (s.phase === 'focus') {
    const completed = s.completed + 1
    const long = completed % settingsStore.get().pomodoro.rounds === 0
    enterPhase(long ? 'long' : 'short', completed, s.running)
  } else {
    enterPhase('focus', s.completed, s.running)
  }
}

setInterval(() => {
  const s = pomodoroStore.get()
  if (s.running && Date.now() >= s.endsAt) advance()
}, 250)

// When durations change on an untouched timer, show the new length straight away.
settingsStore.subscribe(() => {
  const s = pomodoroStore.get()
  if (!s.running && !s.touched) {
    const ms = phaseMs(s.phase)
    if (ms !== s.remainingMs) pomodoroStore.patch({ remainingMs: ms })
  }
})

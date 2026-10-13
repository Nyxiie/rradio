import { useEffect, useState } from 'react'
import { pausePomodoro, resetPomodoro, skipPhase, startPomodoro, usePomodoro, type PomodoroPhase } from '../lib/pomodoro'
import { useSettings } from '../lib/settings'
import { Panel, buttonClass, formatTime } from './ui'

const LABEL: Record<PomodoroPhase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }

/** Remaining ms for display; re-renders every 250ms only while running. */
export function usePomodoroRemaining(): number {
  const running = usePomodoro((s) => s.running)
  const endsAt = usePomodoro((s) => s.endsAt)
  const remaining = usePomodoro((s) => s.remainingMs)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])
  return running ? Math.max(0, endsAt - now) : remaining
}

export default function Pomodoro() {
  const phase = usePomodoro((s) => s.phase)
  const running = usePomodoro((s) => s.running)
  const completed = usePomodoro((s) => s.completed)
  const rounds = useSettings((s) => s.pomodoro.rounds)
  const remaining = usePomodoroRemaining()
  const inCycle = completed % rounds

  return (
    <Panel title="Pomodoro">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted">{LABEL[phase]}</p>
        <p className="my-1 text-5xl font-bold tabular-nums" aria-live="off">
          {formatTime(remaining)}
        </p>
        <div className="mb-3 flex justify-center gap-1.5" aria-label={`${inCycle} of ${rounds} focus sessions done`}>
          {Array.from({ length: rounds }, (_, i) => (
            <span key={i} className={`size-2.5 border-2 border-line ${i < inCycle ? 'bg-accent' : ''}`} />
          ))}
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={running ? pausePomodoro : startPomodoro} className={buttonClass}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button onClick={skipPhase} className={buttonClass}>
            Skip
          </button>
          <button onClick={resetPomodoro} className={buttonClass}>
            Reset
          </button>
        </div>
      </div>
    </Panel>
  )
}

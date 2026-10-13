import { useEffect, useState } from 'react'
import { cancelSleepTimer, startSleepTimer, useSleep } from '../lib/sleepTimer'
import { Panel, buttonClass, formatTime } from './ui'

const PRESETS = [15, 30, 45, 60, 90]

export default function SleepTimer() {
  const endsAt = useSleep((s) => s.endsAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <Panel title="Sleep timer">
      {endsAt ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            Fading out in <span className="font-bold tabular-nums">{formatTime(endsAt - now)}</span>
          </p>
          <button onClick={cancelSleepTimer} className={buttonClass}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((m) => (
            <button key={m} onClick={() => startSleepTimer(m)} className={buttonClass}>
              {m} min
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}

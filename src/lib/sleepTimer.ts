import { stopAllAmbient } from './ambient/mixer'
import { fadeOutAndPause } from './player/engine'
import { createStore, useStore } from './store'

interface SleepState {
  /** ms epoch when the timer fires, or 0 when off. */
  endsAt: number
}

export const sleepStore = createStore<SleepState>({ endsAt: 0 })
export const useSleep = <S,>(selector: (s: SleepState) => S) => useStore(sleepStore, selector)

export function startSleepTimer(minutes: number): void {
  sleepStore.set({ endsAt: Date.now() + minutes * 60_000 })
}

export function cancelSleepTimer(): void {
  sleepStore.set({ endsAt: 0 })
}

setInterval(() => {
  const { endsAt } = sleepStore.get()
  if (endsAt && Date.now() >= endsAt) {
    sleepStore.set({ endsAt: 0 })
    stopAllAmbient()
    void fadeOutAndPause(8000)
  }
}, 500)

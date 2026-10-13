import { getAudioContext } from './ambient/context'

/** Short three-note bell, synthesised so no asset is needed. */
export function playChime(): void {
  try {
    const ctx = getAudioContext()
    const t0 = ctx.currentTime + 0.02
    const master = ctx.createGain()
    master.gain.value = 0.25
    master.connect(ctx.destination)
    ;[784, 988, 1319].forEach((freq, i) => {
      const t = t0 + i * 0.18
      for (const [mult, level] of [
        [1, 1],
        [2.01, 0.25],
      ] as const) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = freq * mult
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(level, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
        o.connect(g).connect(master)
        o.start(t)
        o.stop(t + 1.7)
      }
    })
    setTimeout(() => master.disconnect(), 3000)
  } catch {
    /* audio unavailable: the visual phase change still happens */
  }
}

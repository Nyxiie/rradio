import type { AmbientId } from '../../config/ambient'

/**
 * Procedural ambient sounds. Everything is generated from random noise buffers,
 * filters, LFOs and a few scheduled events; no audio files are involved.
 */

export interface NoiseBuffers {
  pink: AudioBuffer
  brown: AudioBuffer
  white: AudioBuffer
  /** Sparse random clicks; filtered differently per layer for vinyl/fire/rain drops. */
  crackle: AudioBuffer
  /** Very sparse, louder clicks used for fire pops. */
  pops: AudioBuffer
}

export interface Layer {
  out: GainNode
  stop(): void
}

const SECONDS = 10
const FADE = 0.5

/** Cross-fades the tail into the head so the loop has no audible seam. */
function loopable(data: Float32Array, length: number, fade: number): Float32Array {
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) out[i] = data[i]
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    out[i] = data[i] * Math.sqrt(t) + data[length + i] * Math.sqrt(1 - t)
  }
  return out
}

function makeBuffer(ctx: AudioContext, fill: (data: Float32Array, n: number) => void): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(SECONDS * rate)
  const fade = Math.floor(FADE * rate)
  const raw = new Float32Array(length + fade)
  fill(raw, raw.length)
  const buf = ctx.createBuffer(1, length, rate)
  buf.copyToChannel(loopable(raw, length, fade) as Float32Array<ArrayBuffer>, 0)
  return buf
}

function impulses(ctx: AudioContext, perSecond: number, curve: number, decayMs: number): AudioBuffer {
  const rate = ctx.sampleRate
  const buf = ctx.createBuffer(1, Math.floor(SECONDS * rate), rate)
  const data = buf.getChannelData(0)
  const p = perSecond / rate
  const decay = Math.max(1, (decayMs / 1000) * rate)
  for (let i = 0; i < data.length; i++) {
    if (Math.random() < p) {
      const amp = Math.random() ** curve * (Math.random() < 0.5 ? -1 : 1)
      for (let k = 0; k < decay * 5 && i + k < data.length; k++) data[i + k] += amp * Math.exp(-k / decay)
    }
  }
  return buf
}

export function createNoiseBuffers(ctx: AudioContext): NoiseBuffers {
  return {
    white: makeBuffer(ctx, (d, n) => {
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    }),
    pink: makeBuffer(ctx, (d, n) => {
      // Paul Kellet's economy pink noise filter.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      }
    }),
    brown: makeBuffer(ctx, (d, n) => {
      let last = 0
      for (let i = 0; i < n; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
        d[i] = last * 3.5
      }
    }),
    crackle: impulses(ctx, 14, 3, 1.2),
    pops: impulses(ctx, 5, 2, 6),
  }
}

// ---- small graph helpers ---------------------------------------------------

type Disposable = { stop(): void }

class Builder {
  readonly out: GainNode
  private sources: AudioScheduledSourceNode[] = []
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private nodes: AudioNode[] = []
  private stopped = false

  constructor(
    readonly ctx: AudioContext,
    readonly bufs: NoiseBuffers,
    level: number,
  ) {
    this.out = ctx.createGain()
    this.out.gain.value = level
    this.nodes.push(this.out)
  }

  /** Registers a source so it is stopped with the layer. */
  track(source: AudioScheduledSourceNode): void {
    this.sources.push(source)
  }

  /** Looping buffer source starting at a random offset so layers never phase-lock. */
  loop(buf: AudioBuffer, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.playbackRate.value = rate
    s.start(0, Math.random() * buf.duration)
    this.sources.push(s)
    return s
  }

  filter(type: BiquadFilterType, freq: number, q = 0.707): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    this.nodes.push(f)
    return f
  }

  gain(value: number): GainNode {
    const g = this.ctx.createGain()
    g.gain.value = value
    this.nodes.push(g)
    return g
  }

  /** Low-frequency oscillator that modulates `target` by +/- `depth`. */
  lfo(freq: number, depth: number, target: AudioParam, type: OscillatorType = 'sine'): void {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = this.gain(depth)
    o.connect(g).connect(target)
    o.start()
    this.sources.push(o)
  }

  /** Runs `fn` at random intervals between min and max seconds until stopped. */
  every(minS: number, maxS: number, fn: () => void): void {
    const schedule = () => {
      const t = setTimeout(() => {
        // Forget fired timers so the set does not grow for as long as the layer plays.
        this.timers.delete(t)
        if (this.stopped) return
        fn()
        schedule()
      }, (minS + Math.random() * (maxS - minS)) * 1000)
      this.timers.add(t)
    }
    schedule()
  }

  /** Plays a one-shot node chain that cleans itself up. */
  oneShot(durationS: number, build: (end: number) => AudioNode[]): void {
    const end = this.ctx.currentTime + durationS
    const nodes = build(end)
    setTimeout(() => nodes.forEach((n) => n.disconnect()), durationS * 1000 + 200)
  }

  asLayer(): Layer & Disposable {
    return {
      out: this.out,
      stop: () => {
        this.stopped = true
        this.timers.forEach(clearTimeout)
        this.timers.clear()
        for (const s of this.sources) {
          try {
            s.stop()
          } catch {
            /* already stopped */
          }
        }
        // Disconnect shortly after so the caller's fade-out is not cut off.
        setTimeout(() => this.nodes.forEach((n) => n.disconnect()), 400)
      },
    }
  }
}

// ---- layer recipes ---------------------------------------------------------

function rainBed(b: Builder, into: AudioNode, brightness = 1): void {
  const hp = b.filter('highpass', 500)
  const lp = b.filter('lowpass', 7500 * brightness)
  const shelf = b.filter('peaking', 3200, 0.6)
  shelf.gain.value = 4
  const g = b.gain(0.55)
  b.loop(b.bufs.pink).connect(hp)
  hp.connect(shelf).connect(lp).connect(g).connect(into)
  // Individual droplets on top of the wash.
  const hit = b.filter('highpass', 2500)
  const hg = b.gain(0.5)
  b.loop(b.bufs.crackle, 4).connect(hit)
  hit.connect(hg).connect(into)
}

const recipes: Record<AmbientId, (b: Builder) => void> = {
  rain(b) {
    rainBed(b, b.out)
  },

  vinyl(b) {
    // Surface noise: soft hiss plus random pops, with a slow rumble.
    const hp = b.filter('highpass', 2000)
    const hiss = b.gain(0.08)
    b.loop(b.bufs.white).connect(hp)
    hp.connect(hiss).connect(b.out)
    const bp = b.filter('bandpass', 3500, 0.5)
    const cg = b.gain(1.1)
    b.loop(b.bufs.crackle).connect(bp)
    bp.connect(cg).connect(b.out)
    const pops = b.filter('lowpass', 5000)
    const pg = b.gain(0.5)
    b.loop(b.bufs.pops, 0.8).connect(pops)
    pops.connect(pg).connect(b.out)
    const rumble = b.filter('lowpass', 60)
    const rg = b.gain(0.5)
    b.loop(b.bufs.brown).connect(rumble)
    rumble.connect(rg).connect(b.out)
  },

  fire(b) {
    // Low roar that breathes, plus crackles and occasional pops.
    const lp = b.filter('lowpass', 500)
    const roar = b.gain(0.9)
    b.loop(b.bufs.brown).connect(lp)
    lp.connect(roar).connect(b.out)
    b.lfo(0.23, 0.25, roar.gain)
    b.lfo(0.6, 120, lp.frequency)
    const bp = b.filter('bandpass', 2200, 0.7)
    const cg = b.gain(1.3)
    b.loop(b.bufs.crackle, 0.6).connect(bp)
    bp.connect(cg).connect(b.out)
    const pp = b.filter('bandpass', 900, 1.2)
    const pg = b.gain(1.4)
    b.loop(b.bufs.pops, 1).connect(pp)
    pp.connect(pg).connect(b.out)
  },

  ocean(b) {
    // Two detuned swells: filtered noise whose level and brightness rise and fall.
    for (const [rate, depth, cutoff] of [
      [0.09, 0.45, 900],
      [0.13, 0.35, 1400],
    ] as const) {
      const lp = b.filter('lowpass', cutoff)
      const g = b.gain(0.5)
      b.loop(b.bufs.pink).connect(lp)
      lp.connect(g).connect(b.out)
      b.lfo(rate, depth, g.gain)
      b.lfo(rate, cutoff * 0.5, lp.frequency)
    }
    const hp = b.filter('highpass', 2500)
    const foam = b.gain(0.12)
    b.loop(b.bufs.white).connect(hp)
    hp.connect(foam).connect(b.out)
    b.lfo(0.11, 0.1, foam.gain)
  },

  tape(b) {
    // Hiss with slow wow/flutter and a faint mains hum.
    const bp = b.filter('bandpass', 6500, 0.35)
    const hiss = b.gain(0.3)
    b.loop(b.bufs.white).connect(bp)
    bp.connect(hiss).connect(b.out)
    b.lfo(0.4, 800, bp.frequency)
    const hum = b.ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 50
    const hg = b.gain(0.012)
    hum.connect(hg).connect(b.out)
    hum.start()
    b.lfo(0.7, 0.4, hum.frequency)
    const ticks = b.filter('bandpass', 4500, 0.8)
    const tg = b.gain(0.35)
    b.loop(b.bufs.crackle, 0.4).connect(ticks)
    ticks.connect(tg).connect(b.out)
    b.track(hum)
  },

  woods(b) {
    // Wind in leaves plus the occasional bird.
    const bp = b.filter('bandpass', 700, 0.9)
    const wind = b.gain(0.8)
    b.loop(b.bufs.pink).connect(bp)
    bp.connect(wind).connect(b.out)
    b.lfo(0.07, 0.4, wind.gain)
    b.lfo(0.05, 350, bp.frequency)
    const leaves = b.filter('highpass', 3000)
    const lg = b.gain(0.18)
    b.loop(b.bufs.white).connect(leaves)
    leaves.connect(lg).connect(b.out)
    b.lfo(0.09, 0.12, lg.gain)
    b.every(3, 11, () => {
      const base = 2200 + Math.random() * 1800
      const chirps = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < chirps; i++) {
        const t0 = b.ctx.currentTime + i * 0.16
        const o = b.ctx.createOscillator()
        const g = b.ctx.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(base, t0)
        o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.07)
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1)
        o.connect(g).connect(b.out)
        o.start(t0)
        o.stop(t0 + 0.12)
        setTimeout(() => g.disconnect(), 1500)
      }
    })
  },

  river(b) {
    // Rushing water: broad band plus a burbling mid-band modulated quickly.
    const bp = b.filter('bandpass', 1100, 0.6)
    const g = b.gain(0.9)
    b.loop(b.bufs.pink).connect(bp)
    bp.connect(g).connect(b.out)
    b.lfo(0.17, 0.2, g.gain)
    const bp2 = b.filter('bandpass', 2400, 1.4)
    const g2 = b.gain(0.4)
    b.loop(b.bufs.pink, 1.3).connect(bp2)
    bp2.connect(g2).connect(b.out)
    b.lfo(4.5, 0.25, g2.gain)
    b.lfo(2.1, 700, bp2.frequency)
    const hp = b.filter('highpass', 4500)
    const sp = b.gain(0.1)
    b.loop(b.bufs.white).connect(hp)
    hp.connect(sp).connect(b.out)
  },

  storm(b) {
    rainBed(b, b.out, 0.9)
    // Wind and distant rumble.
    const lp = b.filter('lowpass', 250)
    const rg = b.gain(0.8)
    b.loop(b.bufs.brown).connect(lp)
    lp.connect(rg).connect(b.out)
    b.lfo(0.08, 0.35, rg.gain)
    b.every(7, 22, () => {
      // Thunder: a burst of low brown noise with a long decay.
      const dur = 3 + Math.random() * 3
      b.oneShot(dur, (end) => {
        const src = b.ctx.createBufferSource()
        src.buffer = b.bufs.brown
        src.loop = true
        const f = b.ctx.createBiquadFilter()
        f.type = 'lowpass'
        const t0 = b.ctx.currentTime
        f.frequency.setValueAtTime(260, t0)
        f.frequency.exponentialRampToValueAtTime(70, end)
        const g = b.ctx.createGain()
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(1.6, t0 + 0.25)
        g.gain.exponentialRampToValueAtTime(0.0001, end)
        src.connect(f).connect(g).connect(b.out)
        src.start(t0, Math.random() * SECONDS)
        src.stop(end + 0.1)
        return [src, f, g]
      })
    })
  },
}

/** Per-layer headroom so that every layer is roughly equally loud at the same slider position. */
const LEVEL: Record<AmbientId, number> = {
  rain: 0.5,
  vinyl: 0.55,
  fire: 0.6,
  ocean: 0.7,
  tape: 0.35,
  woods: 0.55,
  river: 0.5,
  storm: 0.5,
}

export function buildLayer(ctx: AudioContext, bufs: NoiseBuffers, id: AmbientId): Layer {
  const b = new Builder(ctx, bufs, LEVEL[id])
  recipes[id](b)
  return b.asLayer()
}

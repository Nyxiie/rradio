import type { MetadataSource, NowPlaying } from '../../types'

type Poller = { url: string; parse: (json: unknown, withArt: boolean) => NowPlaying | null }

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** AzuraCast "now playing" API (used by freeCodeCamp Code Radio and loficafe.net). */
function parseAzuracast(json: unknown, withArt: boolean): NowPlaying | null {
  const j = json as {
    now_playing?: { song?: { title?: string; artist?: string; album?: string; art?: string }; duration?: number; played_at?: number }
    listeners?: { current?: number }
  }
  const song = j.now_playing?.song
  const title = str(song?.title)
  if (!title) return null
  return {
    title,
    artist: str(song?.artist),
    album: str(song?.album),
    artUrl: withArt ? str(song?.art) : undefined,
    duration: j.now_playing?.duration,
    startedAt: j.now_playing?.played_at ? j.now_playing.played_at * 1000 : undefined,
    listeners: j.listeners?.current,
  }
}

function pollerFor(source: MetadataSource): Poller | null {
  switch (source.kind) {
    case 'azuracast':
      return { url: source.url, parse: parseAzuracast }
    default:
      return null
  }
}

/**
 * Polls a JSON now-playing endpoint. Failures (CORS, offline) are silent: the UI
 * then just shows the station name. Returns a stop function.
 */
export function startPolling(
  source: MetadataSource,
  onUpdate: (np: NowPlaying | null) => void,
  opts: { art: boolean; intervalMs: number },
): () => void {
  const poller = pollerFor(source)
  if (!poller) return () => {}
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const ctrl = new AbortController()

  const tick = async () => {
    try {
      const res = await fetch(poller.url, { signal: ctrl.signal, cache: 'no-store' })
      if (res.ok) {
        const np = poller.parse(await res.json(), opts.art)
        if (!stopped) onUpdate(np)
      }
    } catch {
      /* ignore: next tick retries */
    }
    if (!stopped) timer = setTimeout(tick, opts.intervalMs)
  }
  void tick()

  return () => {
    stopped = true
    ctrl.abort()
    if (timer) clearTimeout(timer)
  }
}

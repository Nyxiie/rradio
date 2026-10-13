export interface PlaylistEntry {
  url: string
  title?: string
}

export interface ParsedPlaylist {
  entries: PlaylistEntry[]
  /** True for HLS (#EXT-X-*) playlists, which most non-Safari browsers cannot play in <audio>. */
  hls: boolean
}

export type PlaylistKind = 'm3u' | 'pls' | 'direct'

/** Guess what a URL points at from its path; query strings and hashes are ignored. */
export function detectKind(url: string): PlaylistKind {
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    /* fall through with the raw string */
  }
  const lower = path.toLowerCase()
  if (lower.endsWith('.pls')) return 'pls'
  if (lower.endsWith('.m3u') || lower.endsWith('.m3u8')) return 'm3u'
  return 'direct'
}

function resolve(candidate: string, base?: string): string | null {
  try {
    const u = new URL(candidate, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function parseM3u(text: string, base?: string): ParsedPlaylist {
  const hls = /#EXT-X-/i.test(text)
  const entries: PlaylistEntry[] = []
  let pendingTitle: string | undefined
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      const m = /^#EXTINF:[^,]*,(.*)$/i.exec(line)
      if (m) pendingTitle = m[1].trim() || undefined
      continue
    }
    const url = resolve(line, base)
    if (url) entries.push({ url, title: pendingTitle })
    pendingTitle = undefined
  }
  return { entries, hls }
}

export function parsePls(text: string, base?: string): ParsedPlaylist {
  const files = new Map<number, string>()
  const titles = new Map<number, string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^\s*(File|Title)(\d+)\s*=\s*(.*)$/i.exec(rawLine)
    if (!m) continue
    const n = Number(m[2])
    if (m[1].toLowerCase() === 'file') files.set(n, m[3].trim())
    else titles.set(n, m[3].trim())
  }
  const entries: PlaylistEntry[] = []
  for (const n of [...files.keys()].sort((a, b) => a - b)) {
    const url = resolve(files.get(n)!, base)
    if (url) entries.push({ url, title: titles.get(n) || undefined })
  }
  return { entries, hls: false }
}

/** Parses pasted or fetched playlist text, sniffing the format when the kind is unknown. */
export function parsePlaylist(text: string, kind: PlaylistKind, base?: string): ParsedPlaylist {
  if (kind === 'pls' || /^\s*\[playlist\]/i.test(text)) return parsePls(text, base)
  return parseM3u(text, base)
}

export class PlaylistFetchError extends Error {
  /** True when the failure is most likely CORS or a network block, so pasting is the way forward. */
  readonly blocked: boolean
  constructor(message: string, blocked: boolean) {
    super(message)
    this.blocked = blocked
  }
}

const MAX_PLAYLIST_BYTES = 200_000
const FETCH_TIMEOUT_MS = 15_000

/** Reads at most `max` bytes, so a URL that is really an endless audio stream cannot exhaust memory. */
async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, max)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < max) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
  const buf = new Uint8Array(Math.min(total, max))
  let offset = 0
  for (const c of chunks) {
    const part = c.subarray(0, buf.length - offset)
    buf.set(part, offset)
    offset += part.length
    if (offset >= buf.length) break
  }
  return new TextDecoder().decode(buf)
}

/** Fetches a playlist in the browser. No proxy is used, so the host must allow CORS. */
export async function fetchPlaylist(url: string): Promise<ParsedPlaylist> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(url, { mode: 'cors', cache: 'no-store', credentials: 'omit', signal: ctrl.signal })
    } catch {
      if (ctrl.signal.aborted) throw new PlaylistFetchError('The playlist host did not answer in time.', false)
      throw new PlaylistFetchError(
        'The browser could not load this playlist. The host most likely blocks cross-origin requests (CORS).',
        true,
      )
    }
    if (!res.ok) throw new PlaylistFetchError(`The host answered ${res.status}.`, false)
    let text: string
    try {
      text = await readCapped(res, MAX_PLAYLIST_BYTES)
    } catch {
      throw new PlaylistFetchError('The playlist could not be read.', false)
    }
    const parsed = parsePlaylist(text, detectKind(url), url)
    if (!parsed.entries.length) throw new PlaylistFetchError('No stream entries found in that playlist.', false)
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

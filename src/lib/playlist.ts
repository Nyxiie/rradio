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

/** Fetches a playlist in the browser. No proxy is used, so the host must allow CORS. */
export async function fetchPlaylist(url: string): Promise<ParsedPlaylist> {
  let res: Response
  try {
    res = await fetch(url, { mode: 'cors', cache: 'no-store' })
  } catch {
    throw new PlaylistFetchError(
      'The browser could not load this playlist. The host most likely blocks cross-origin requests (CORS).',
      true,
    )
  }
  if (!res.ok) throw new PlaylistFetchError(`The host answered ${res.status}.`, false)
  const text = (await res.text()).slice(0, 200_000)
  const parsed = parsePlaylist(text, detectKind(url), url)
  if (!parsed.entries.length) throw new PlaylistFetchError('No stream entries found in that playlist.', false)
  return parsed
}

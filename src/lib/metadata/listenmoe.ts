import type { NowPlaying } from '../../types'
import { backoffDelay } from '../backoff'

const COVER_BASE = 'https://cdn.listen.moe/covers/'
const ARTIST_BASE = 'https://cdn.listen.moe/artists/'

interface GatewayMessage {
  op: number
  t?: string
  d?: {
    heartbeat?: number
    song?: {
      title?: string
      artists?: { name?: string; nameRomaji?: string | null; image?: string | null }[]
      albums?: { name?: string; nameRomaji?: string | null; image?: string | null }[]
      duration?: number
    }
    startTime?: string
    listeners?: number
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const list = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

function toNowPlaying(d: NonNullable<GatewayMessage['d']>, withArt: boolean): NowPlaying | null {
  // Validate shapes: the gateway is third-party and anything rendered must be a string.
  const song = d.song
  const title = text(song?.title)
  if (!song || !title) return null
  const artists = list(song.artists)
  const artist = artists.map((a) => text(a.nameRomaji) || text(a.name)).filter(Boolean).join(', ')
  const album = list(song.albums)[0]
  const artistImage = artists.map((a) => text(a.image)).find(Boolean)
  let artUrl: string | undefined
  if (withArt) {
    const albumImage = text(album?.image)
    if (albumImage) artUrl = COVER_BASE + encodeURIComponent(albumImage)
    else if (artistImage) artUrl = ARTIST_BASE + encodeURIComponent(artistImage)
  }
  const started = typeof d.startTime === 'string' ? Date.parse(d.startTime) : NaN
  return {
    title,
    artist: artist || undefined,
    album: text(album?.nameRomaji) || text(album?.name),
    artUrl,
    startedAt: Number.isFinite(started) ? started : undefined,
    duration: num(song.duration),
    listeners: num(d.listeners),
  }
}

/**
 * listen.moe gateway client. Protocol (verified against the live gateway):
 *  - server sends op 0 {heartbeat: ms}; client then sends op 9 every `heartbeat` ms (server replies op 10)
 *  - server pushes op 1 with t = "TRACK_UPDATE" and the current song, also right after connecting
 *  - no authentication is needed for read-only now-playing data
 * Reconnects with backoff when the socket closes or the heartbeat is not answered.
 */
export function connectListenMoe(
  gateway: string,
  onUpdate: (np: NowPlaying) => void,
  opts: { art: boolean },
): () => void {
  let ws: WebSocket | null = null
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let stopped = false
  let gotAck = true

  const clearHeartbeat = () => {
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = undefined
  }

  const scheduleReconnect = () => {
    if (stopped || retry) return
    retry = setTimeout(() => {
      retry = undefined
      open()
    }, backoffDelay(attempt++))
  }

  const open = () => {
    if (stopped) return
    let socket: WebSocket
    try {
      socket = new WebSocket(gateway)
    } catch {
      scheduleReconnect()
      return
    }
    ws = socket
    socket.onmessage = (ev) => {
      // Messages already queued when stop() ran must not start a new heartbeat or update the UI.
      if (stopped || ws !== socket) return
      let msg: GatewayMessage
      try {
        msg = JSON.parse(String(ev.data)) as GatewayMessage
      } catch {
        return
      }
      if (!msg || typeof msg !== 'object') return
      if (msg.op === 0 && typeof msg.d?.heartbeat === 'number' && msg.d.heartbeat > 0) {
        attempt = 0
        clearHeartbeat()
        gotAck = true
        heartbeat = setInterval(() => {
          if (!gotAck) {
            // Server stopped answering: drop the socket and reconnect.
            socket.close()
            return
          }
          gotAck = false
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: 9 }))
        }, Math.max(5_000, msg.d.heartbeat))
      } else if (msg.op === 10) {
        gotAck = true
      } else if (msg.op === 1 && msg.d) {
        const np = toNowPlaying(msg.d, opts.art)
        if (np) onUpdate(np)
      }
    }
    socket.onclose = () => {
      clearHeartbeat()
      if (ws === socket) ws = null
      scheduleReconnect()
    }
    socket.onerror = () => socket.close()
  }

  open()

  return () => {
    stopped = true
    clearHeartbeat()
    if (retry) clearTimeout(retry)
    if (ws) {
      ws.onclose = null
      ws.onmessage = null
      ws.close()
      ws = null
    }
  }
}

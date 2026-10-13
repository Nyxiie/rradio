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

function toNowPlaying(d: NonNullable<GatewayMessage['d']>, withArt: boolean): NowPlaying | null {
  const song = d.song
  if (!song?.title) return null
  const artist = song.artists?.map((a) => a.nameRomaji || a.name).filter(Boolean).join(', ')
  const album = song.albums?.[0]
  const artistImage = song.artists?.find((a) => a.image)?.image
  let artUrl: string | undefined
  if (withArt) {
    if (album?.image) artUrl = COVER_BASE + encodeURIComponent(album.image)
    else if (artistImage) artUrl = ARTIST_BASE + encodeURIComponent(artistImage)
  }
  const started = d.startTime ? Date.parse(d.startTime) : NaN
  return {
    title: song.title,
    artist: artist || undefined,
    album: album?.nameRomaji || album?.name,
    artUrl,
    startedAt: Number.isFinite(started) ? started : undefined,
    duration: song.duration,
    listeners: d.listeners,
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
      let msg: GatewayMessage
      try {
        msg = JSON.parse(String(ev.data)) as GatewayMessage
      } catch {
        return
      }
      if (msg.op === 0 && msg.d?.heartbeat) {
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
        }, msg.d.heartbeat)
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
      ws.close()
    }
  }
}

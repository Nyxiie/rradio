import { currentStation, next, pause, play, playerStore, prev } from './engine'

/** Wires the Media Session API so media keys and OS now-playing widgets work. */
export function initMediaSession(): void {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  const bind = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(action, handler)
    } catch {
      /* action not supported by this browser */
    }
  }
  bind('play', play)
  bind('pause', pause)
  bind('stop', pause)
  bind('nexttrack', next)
  bind('previoustrack', prev)

  const update = () => {
    const { status, nowPlaying } = playerStore.get()
    const station = currentStation()
    if (!station) return
    ms.playbackState = status === 'playing' ? 'playing' : status === 'idle' ? 'none' : 'paused'
    const icon = [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
    ms.metadata = new MediaMetadata({
      title: nowPlaying?.title ?? station.name,
      artist: nowPlaying?.artist ?? (nowPlaying ? station.name : 'rradio'),
      album: nowPlaying?.album ?? station.name,
      artwork: nowPlaying?.artUrl ? [{ src: nowPlaying.artUrl }] : icon,
    })
  }
  playerStore.subscribe(update)
  update()
}

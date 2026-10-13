import type { Station } from '../types'

/**
 * Station registry. This is the ONLY place built-in stations are defined:
 * add an entry here and it shows up in the list, the player and the media keys.
 * Remove or comment out an entry to turn a station off.
 */
export const STATIONS: Station[] = [
  {
    id: 'listenmoe-jpop',
    name: 'LISTEN.moe J-pop',
    description: 'Japanese pop, anime and game music',
    tags: ['J-pop', 'Anime'],
    // Ogg Vorbis is not supported by Safari, so the MP3 mount is used there.
    streamUrl: 'https://listen.moe/stream',
    streamMime: 'audio/ogg; codecs=vorbis',
    fallbackUrl: 'https://listen.moe/fallback',
    metadata: { kind: 'listenmoe', gateway: 'wss://listen.moe/gateway_v2' },
  },
  {
    id: 'listenmoe-kpop',
    name: 'LISTEN.moe K-pop',
    description: 'Korean pop',
    tags: ['K-pop'],
    streamUrl: 'https://listen.moe/kpop/stream',
    streamMime: 'audio/ogg; codecs=vorbis',
    fallbackUrl: 'https://listen.moe/kpop/fallback',
    metadata: { kind: 'listenmoe', gateway: 'wss://listen.moe/kpop/gateway_v2' },
  },
  ...(
    [
      ['chilling', 'Chilling', 'Lofi for relaxing', 'Chilling'],
      ['studying', 'Studying', 'Lofi for study sessions', 'Studying'],
      ['working', 'Working', 'Lofi for work', 'Working'],
      ['sleeping', 'Sleeping', 'Lofi for sleep', 'Sleeping'],
      ['gaming', 'Gaming', 'Lofi for gaming', 'Gaming'],
      ['japanese-lofi', 'Japanese Lofi', 'Lofi for late-night Japanese moods', 'Japanese'],
    ] as const
  ).map(
    ([slug, name, description, tag]): Station => ({
      id: `loficafe-${slug}`,
      name: `Lofi Cafe ${name}`,
      description,
      tags: ['Lofi', tag],
      streamUrl: `https://radio.loficafe.net/listen/${slug}/radio.mp3`,
      metadata: { kind: 'azuracast', url: `https://radio.loficafe.net/api/nowplaying/${slug}` },
    }),
  ),
  {
    id: 'flux-chillhop',
    name: 'FluxFM Chillhop',
    description: 'Chillhop and instrumental hip hop',
    tags: ['Lofi', 'Chillhop'],
    streamUrl: 'https://streams.fluxfm.de/Chillhop/mp3-320/streams.fluxfm.de/',
    metadata: { kind: 'none' },
  },
  {
    id: 'coderadio',
    name: 'Code Radio',
    description: 'freeCodeCamp: beats to code to',
    tags: ['Focus', 'Lofi'],
    streamUrl: 'https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3',
    dataSaverUrl: 'https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/low.mp3',
    metadata: {
      kind: 'azuracast',
      url: 'https://coderadio-admin-v2.freecodecamp.org/api/nowplaying/coderadio',
    },
  },
]

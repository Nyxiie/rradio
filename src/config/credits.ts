import type { AmbientId } from './ambient'

/** Sources of the bundled ambient recordings. Keep in sync with public/ambient/CREDITS.md. */
export const AMBIENT_CREDITS: {
  id: AmbientId
  label: string
  title: string
  author: string
  url: string
  licence: string
}[] = [
  {
    id: 'rain',
    label: 'Rain',
    title: 'Summer Rain on Terrace',
    author: 'Joseph Sardin',
    url: 'https://bigsoundbank.com/summer-rain-on-terrace-s1019.html',
    licence: 'CC0 1.0',
  },
  {
    id: 'vinyl',
    label: 'Vinyl',
    title: 'Vinyl Disc',
    author: 'Joseph Sardin',
    url: 'https://bigsoundbank.com/vinyl-disc-s2547.html',
    licence: 'CC0 1.0',
  },
  {
    id: 'fire',
    label: 'Fire',
    title: 'Fireplace #2',
    author: 'Joseph Sardin',
    url: 'https://bigsoundbank.com/fireplace-2-s0031.html',
    licence: 'CC0 1.0',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    title: 'Sea of the beach of Dellec #1',
    author: 'Joseph Sardin',
    url: 'https://bigsoundbank.com/sea-of-the-beach-of-dellec-1-s2564.html',
    licence: 'CC0 1.0',
  },
  {
    id: 'tape',
    label: 'Tape',
    title: 'Tape Noise Groove, track 4 (filtered)',
    author: 'Antoni Robert (Hazard Records)',
    url: 'https://archive.org/details/hr092',
    licence: 'CC0 1.0',
  },
  {
    id: 'woods',
    label: 'Woods',
    title: 'Forest #3',
    author: 'Pierre Sibanarco',
    url: 'https://bigsoundbank.com/forest-3-s2715.html',
    licence: 'CC0 1.0',
  },
  {
    id: 'river',
    label: 'River',
    title: 'Mountain stream #1',
    author: 'Pierre Sibanarco',
    url: 'https://bigsoundbank.com/mountain-stream-1-s2754.html',
    licence: 'CC0 1.0',
  },
  {
    id: 'storm',
    label: 'Storm',
    title: 'Rain and Thunder #2',
    author: 'Joseph Sardin',
    url: 'https://bigsoundbank.com/rain-and-storm-2-s0740.html',
    licence: 'CC0 1.0',
  },
]

/** Where the radio streams and now-playing data come from. */
export const STATION_CREDITS: { name: string; url: string }[] = [
  { name: 'LISTEN.moe', url: 'https://listen.moe' },
  { name: 'Lofi Cafe', url: 'https://loficafe.net' },
  { name: 'FluxFM', url: 'https://www.fluxfm.de' },
  { name: 'freeCodeCamp Code Radio', url: 'https://coderadio.freecodecamp.org' },
]

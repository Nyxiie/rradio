/**
 * Ambient layers. Each id has a looping recording at public/ambient/<id>.mp3
 * (sources and licences are listed in public/ambient/CREDITS.md).
 * To add a layer: add an id here and drop <id>.mp3 into public/ambient/.
 */
export const AMBIENT_LAYERS = [
  { id: 'rain', label: 'Rain', glyph: '☂' },
  { id: 'vinyl', label: 'Vinyl', glyph: '◎' },
  { id: 'fire', label: 'Fire', glyph: '♨' },
  { id: 'ocean', label: 'Ocean', glyph: '≋' },
  { id: 'tape', label: 'Tape', glyph: '▤' },
  { id: 'woods', label: 'Woods', glyph: '♣' },
  { id: 'river', label: 'River', glyph: '∿' },
  { id: 'storm', label: 'Storm', glyph: '☈' },
] as const

export type AmbientId = (typeof AMBIENT_LAYERS)[number]['id']

export const ambientUrl = (id: AmbientId) => `/ambient/${id}.mp3`

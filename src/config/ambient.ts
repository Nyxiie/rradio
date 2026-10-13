/**
 * Ambient layers. The sounds are synthesised at runtime with the Web Audio API
 * (see src/lib/ambient/synth.ts), so there are no audio files and no licences.
 * To add a layer: add an id here and a builder with the same id in synth.ts.
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

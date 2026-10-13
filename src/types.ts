/** How "now playing" data is obtained for a station. */
export type MetadataSource =
  | { kind: 'listenmoe'; gateway: string }
  | { kind: 'azuracast'; url: string }
  | { kind: 'none' }

export interface Station {
  id: string
  name: string
  description?: string
  /** Genre tags; the first one is used for grouping. */
  tags: string[]
  streamUrl: string
  /** MIME type of `streamUrl` when browser support is not universal (e.g. Ogg Vorbis). */
  streamMime?: string
  /** Used when `streamMime` is unsupported or after repeated failures. */
  fallbackUrl?: string
  /** Lower-bitrate stream used when Data Saver is on. */
  dataSaverUrl?: string
  metadata: MetadataSource
  /** True for stations the user added; these live in localStorage. */
  custom?: boolean
}

export interface NowPlaying {
  title: string
  artist?: string
  album?: string
  artUrl?: string
  /** ms epoch when the track started, if known. */
  startedAt?: number
  /** seconds */
  duration?: number
  listeners?: number
}

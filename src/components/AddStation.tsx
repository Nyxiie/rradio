import { useState } from 'react'
import { addCustomStation, updateCustomStation } from '../lib/customStations'
import { selectStation } from '../lib/player/engine'
import {
  PlaylistFetchError,
  detectKind,
  fetchPlaylist,
  parsePlaylist,
  type ParsedPlaylist,
  type PlaylistEntry,
} from '../lib/playlist'
import type { Station } from '../types'
import { Modal, buttonClass, inputClass } from './ui'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function validUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export default function AddStation({ editing, onClose }: { editing: Station | null; onClose: () => void }) {
  const [url, setUrl] = useState(editing?.streamUrl ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '')
  const [entries, setEntries] = useState<PlaylistEntry[]>([])
  const [chosen, setChosen] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)

  const kind = detectKind(url)
  const isPlaylist = !editing && kind !== 'direct'
  const needsLoad = isPlaylist && entries.length === 0

  const acceptPlaylist = (parsed: ParsedPlaylist) => {
    if (parsed.hls && !document.createElement('audio').canPlayType('application/vnd.apple.mpegurl')) {
      setError('This is an HLS (.m3u8) stream, which this browser cannot play in an audio element. Safari can.')
      return
    }
    if (!parsed.entries.length) {
      setError('No stream URLs were found in that playlist.')
      return
    }
    // For HLS the playlist URL itself is the stream.
    const hlsUrl = parsed.hls ? validUrl(url) : null
    if (parsed.hls && !hlsUrl) {
      setError('Enter the full http(s) URL of this HLS playlist; it is the stream itself.')
      return
    }
    let list = hlsUrl ? [{ url: hlsUrl, title: undefined }] : parsed.entries
    // Plain http entries cannot play on an https page (mixed content).
    if (location.protocol === 'https:') list = list.filter((e) => e.url.startsWith('https:'))
    if (!list.length) {
      setError('Every stream in that playlist uses plain http, which browsers block on https pages.')
      return
    }
    setEntries(list)
    setChosen(0)
    setError(null)
    setBlocked(false)
    setNotice(`Found ${list.length} stream${list.length === 1 ? '' : 's'}.`)
    if (!name.trim()) setName(list[0].title ?? hostOf(list[0].url))
  }

  const checkUrl = (): string | null => {
    const clean = validUrl(url)
    if (!clean) {
      setError('Enter a full http(s) URL.')
      return null
    }
    if (clean.startsWith('http:') && location.protocol === 'https:') {
      setError('Browsers block plain http streams on https pages. Use an https URL if the station offers one.')
      return null
    }
    return clean
  }

  const load = async () => {
    setError(null)
    setNotice(null)
    const clean = checkUrl()
    if (!clean) return
    setBusy(true)
    try {
      acceptPlaylist(await fetchPlaylist(clean))
    } catch (e) {
      if (e instanceof PlaylistFetchError) {
        setError(e.message)
        setBlocked(e.blocked)
      } else setError('Could not read that playlist.')
    } finally {
      setBusy(false)
    }
  }

  const parsePasted = () => {
    setError(null)
    acceptPlaylist(parsePlaylist(pasted, kind === 'direct' ? 'm3u' : kind, validUrl(url) ?? undefined))
  }

  const save = () => {
    setError(null)
    const finalName = name.trim()
    if (!finalName) {
      setError('Give the station a name.')
      return
    }
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const base = { name: finalName, tags: tagList.length ? tagList : ['Custom'] }

    if (editing) {
      const clean = checkUrl()
      if (!clean) return
      updateCustomStation(editing.id, { ...base, streamUrl: clean, fallbackUrl: editing.fallbackUrl })
      onClose()
      return
    }
    let streamUrl: string | null
    let fallbackUrl: string | undefined
    if (isPlaylist) {
      streamUrl = entries[chosen]?.url ?? null
      fallbackUrl = entries.find((_, i) => i !== chosen)?.url
    } else {
      streamUrl = checkUrl()
    }
    if (!streamUrl) return
    const station = addCustomStation({ ...base, streamUrl, fallbackUrl })
    selectStation(station.id, false)
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit station' : 'Add your own station'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (needsLoad) void load()
          else save()
        }}
      >
        <div>
          <label htmlFor="st-url" className="mb-1 block text-xs font-bold uppercase tracking-wider">
            Stream or playlist URL
          </label>
          <input
            id="st-url"
            className={inputClass}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setEntries([])
              setBlocked(false)
              setNotice(null)
            }}
            placeholder="https://example.com/stream.mp3  or  .../radio.pls"
            inputMode="url"
            autoFocus
          />
          <p className="mt-1 text-xs text-muted">
            Direct MP3/AAC/Ogg/Opus streams, or .m3u / .m3u8 / .pls playlists. Everything stays in this browser.
          </p>
        </div>

        {entries.length > 1 && (
          <fieldset>
            <legend className="mb-1 text-xs font-bold uppercase tracking-wider">Pick a stream</legend>
            <div className="max-h-40 space-y-1 overflow-y-auto border-2 border-line p-2">
              {entries.map((e, i) => (
                <label key={`${i}-${e.url}`} className="flex cursor-pointer items-start gap-2 text-xs">
                  <input type="radio" name="entry" checked={chosen === i} onChange={() => setChosen(i)} className="mt-0.5" />
                  <span className="min-w-0 break-all">{e.title ? `${e.title} (${hostOf(e.url)})` : e.url}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {blocked && (
          <div>
            <label htmlFor="st-paste" className="mb-1 block text-xs font-bold uppercase tracking-wider">
              Paste the playlist contents instead
            </label>
            <textarea
              id="st-paste"
              className={`${inputClass} h-28 font-mono text-xs`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'[playlist]\nFile1=https://...'}
            />
            <button type="button" onClick={parsePasted} disabled={!pasted.trim()} className={`${buttonClass} mt-2`}>
              Read pasted text
            </button>
          </div>
        )}

        {(!needsLoad || editing) && (
          <>
            <div>
              <label htmlFor="st-name" className="mb-1 block text-xs font-bold uppercase tracking-wider">
                Name
              </label>
              <input id="st-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div>
              <label htmlFor="st-tags" className="mb-1 block text-xs font-bold uppercase tracking-wider">
                Genres (comma separated)
              </label>
              <input id="st-tags" className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Jazz, Chill" />
            </div>
          </>
        )}

        {notice && <p className="text-xs text-muted">{notice}</p>}
        {error && (
          <p role="alert" className="border-2 border-accent p-2 text-xs text-accent">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !url.trim()} className={`${buttonClass} bg-accent text-accent-fg`}>
            {busy ? 'Loading…' : needsLoad ? 'Load playlist' : editing ? 'Save' : 'Add station'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

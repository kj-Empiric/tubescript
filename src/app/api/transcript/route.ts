import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'
import { extractVideoId } from '@/lib/youtube'
import { decodeHtml } from '@/lib/utils'

interface AvailableLang { code: string; name: string; isAuto: boolean }

async function fetchAvailableLanguages(videoId: string): Promise<AvailableLang[]> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []

    const html = await res.text()
    const idx = html.indexOf('"captionTracks":')
    if (idx === -1) return []

    const slice = html.slice(idx + 16)
    let depth = 0, end = 0
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === '[') depth++
      else if (slice[i] === ']') { depth--; if (depth === 0) { end = i + 1; break } }
    }
    if (!end) return []

    const tracks = JSON.parse(slice.slice(0, end)) as Array<{
      languageCode: string
      name?: { simpleText?: string }
      kind?: string
    }>

    // Deduplicate by code — prefer manual (non-asr) over auto when both exist
    const seen = new Map<string, AvailableLang>()
    for (const t of tracks) {
      const isAuto = t.kind === 'asr'
      const existing = seen.get(t.languageCode)
      if (!existing || (!isAuto && existing.isAuto)) {
        seen.set(t.languageCode, {
          code: t.languageCode,
          name: t.name?.simpleText || t.languageCode,
          isAuto,
        })
      }
    }
    return [...seen.values()]
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, lang } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    // Run oEmbed + language list in parallel (only on first fetch, not lang switch)
    const [oEmbedResult, availableLanguages] = await Promise.all([
      fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      ).then((r) => r.ok ? r.json() : null).catch(() => null),
      lang ? Promise.resolve([] as AvailableLang[]) : fetchAvailableLanguages(videoId),
    ])

    const title = oEmbedResult?.title ?? 'Untitled Video'
    const channelName = oEmbedResult?.author_name ?? 'Unknown Channel'

    let raw
    try {
      raw = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('disabled') || msg.includes('Could not get') || msg.includes('subtitles')) {
        return NextResponse.json({ error: 'No captions available for this video' }, { status: 404 })
      }
      if (lang) {
        return NextResponse.json(
          { error: `No captions available in "${lang}" for this video` },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch transcript — video may be private or unavailable' },
        { status: 503 }
      )
    }

    if (!raw?.length) {
      return NextResponse.json({ error: 'Transcript is empty' }, { status: 404 })
    }

    const segments = raw.map((s) => ({
      text: decodeHtml(s.text),
      offset: s.offset,
      duration: s.duration,
    }))

    return NextResponse.json({
      videoId,
      title,
      channelName,
      language: lang ?? (availableLanguages[0]?.code ?? 'en'),
      availableLanguages,
      segments,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

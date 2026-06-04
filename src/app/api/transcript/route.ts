import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube'
import type { Segment } from '@/types/transcript'

interface AvailableLang { code: string; name: string; isAuto: boolean }

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  name?: { simpleText?: string }
  kind?: string
}

// Same client config as youtube-transcript package v1.x — works from Vercel/Lambda IPs
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const CLIENT_VERSION = '20.10.38'
const INNERTUBE_UA = `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14)`

function buildLangList(tracks: CaptionTrack[]): AvailableLang[] {
  const seen = new Map<string, AvailableLang>()
  for (const t of tracks) {
    const isAuto = t.kind === 'asr'
    const existing = seen.get(t.languageCode)
    if (!existing || (!isAuto && existing.isAuto)) {
      seen.set(t.languageCode, {
        code: t.languageCode,
        name: t.name?.simpleText ?? t.languageCode,
        isAuto,
      })
    }
  }
  return [...seen.values()]
}

// Parse YouTube XML transcript — handles both srv3 (<p t=ms d=ms>) and classic (<text start=s dur=s>) formats
function parseXML(xml: string, lang: string): Segment[] {
  const results: Segment[] = []

  // srv3 format: <p t="ms" d="ms"><s>word</s>text</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = pRegex.exec(xml)) !== null) {
    const inner = m[3].replace(/<[^>]+>/g, '') // strip <s> tags
    const text = decodeEntities(inner).replace(/\n/g, ' ').trim()
    if (text) results.push({ text, offset: parseInt(m[1], 10), duration: parseInt(m[2], 10) })
  }
  if (results.length) return results

  // Classic format: <text start="s" dur="s">content</text>
  const classicRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
  while ((m = classicRegex.exec(xml)) !== null) {
    const text = decodeEntities(m[3]).trim()
    if (text) results.push({
      text,
      offset: Math.round(parseFloat(m[1]) * 1000),
      duration: Math.round(parseFloat(m[2]) * 1000),
    })
  }
  return results
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
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

    // Step 1: Fetch player data via Innertube (Android client — no bot detection on Vercel)
    const [playerRes, oEmbedResult] = await Promise.all([
      fetch(INNERTUBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': INNERTUBE_UA },
        body: JSON.stringify({
          videoId,
          context: { client: { clientName: 'ANDROID', clientVersion: CLIENT_VERSION } },
        }),
        signal: AbortSignal.timeout(10000),
      }),
      fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      ).then((r) => r.ok ? r.json() : null).catch(() => null),
    ])

    if (!playerRes.ok) {
      return NextResponse.json({ error: 'Could not reach YouTube' }, { status: 503 })
    }

    const playerData = await playerRes.json()
    const playStatus: string = playerData?.playabilityStatus?.status ?? 'UNKNOWN'

    if (playStatus === 'LOGIN_REQUIRED') {
      return NextResponse.json({ error: 'This video is age-restricted or requires sign-in' }, { status: 403 })
    }
    if (playStatus === 'ERROR' || playStatus === 'UNPLAYABLE') {
      return NextResponse.json({ error: 'Video is unavailable or region-locked' }, { status: 404 })
    }

    const tracks: CaptionTrack[] =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

    if (!tracks.length) {
      return NextResponse.json({ error: 'No captions available for this video' }, { status: 404 })
    }

    const availableLanguages = buildLangList(tracks)

    // Step 2: Pick the right track
    const target = (lang
      ? tracks.find((t) => t.languageCode === lang && t.kind !== 'asr')
        ?? tracks.find((t) => t.languageCode === lang)
      : null)
      ?? tracks.find((t) => t.kind !== 'asr')
      ?? tracks[0]

    if (!target?.baseUrl) {
      return NextResponse.json({ error: 'Caption track URL missing' }, { status: 404 })
    }

    // Step 3: Fetch caption XML
    const captionRes = await fetch(target.baseUrl, {
      headers: { 'User-Agent': INNERTUBE_UA },
      signal: AbortSignal.timeout(8000),
    })

    if (!captionRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch caption data' }, { status: 503 })
    }

    const xml = await captionRes.text()
    const segments = parseXML(xml, target.languageCode)

    if (!segments.length) {
      return NextResponse.json({ error: 'Transcript is empty' }, { status: 404 })
    }

    // Get title from videoDetails (Innertube) or oEmbed fallback
    const videoDetails = playerData?.videoDetails
    const title = videoDetails?.title ?? oEmbedResult?.title ?? 'Untitled Video'
    const channelName = videoDetails?.author ?? oEmbedResult?.author_name ?? 'Unknown Channel'

    return NextResponse.json({
      videoId,
      title,
      channelName,
      language: target.languageCode,
      availableLanguages,
      segments,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

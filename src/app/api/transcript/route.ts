import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube'
import type { Segment } from '@/types/transcript'

interface AvailableLang { code: string; name: string; isAuto: boolean }
interface CaptionTrack { baseUrl: string; languageCode: string; name?: { simpleText?: string }; kind?: string }

// Strategy 1: YouTube Innertube API (Android client)
// Works for most videos. Some datacenter IPs get LOGIN_REQUIRED from YouTube.
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const CLIENT_VER = '20.10.38'
const ANDROID_UA = `com.google.android.youtube/${CLIENT_VER} (Linux; U; Android 14)`

// Strategy 2: HTML scraping fallback
// Sends CONSENT cookie to bypass YouTube's GDPR consent wall on datacenter IPs.
// Looks like a real browser request — passes where Innertube is blocked.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const CONSENT_COOKIE = 'SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI4LjA3X3AwGgJlbiAC; CONSENT=YES+cb.20210328=1'

function buildLangList(tracks: CaptionTrack[]): AvailableLang[] {
  const seen = new Map<string, AvailableLang>()
  for (const t of tracks) {
    const isAuto = t.kind === 'asr'
    const existing = seen.get(t.languageCode)
    if (!existing || (!isAuto && existing.isAuto))
      seen.set(t.languageCode, { code: t.languageCode, name: t.name?.simpleText ?? t.languageCode, isAuto })
  }
  return [...seen.values()]
}

function pickTrack(tracks: CaptionTrack[], lang?: string): CaptionTrack | null {
  if (!tracks.length) return null
  return (lang
    ? tracks.find((t) => t.languageCode === lang && t.kind !== 'asr')
      ?? tracks.find((t) => t.languageCode === lang)
    : null)
    ?? tracks.find((t) => t.kind !== 'asr')
    ?? tracks[0]
}

// Parse YouTube XML transcript (handles srv3 + classic formats)
function parseXML(xml: string): Segment[] {
  const results: Segment[] = []
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = pRegex.exec(xml)) !== null) {
    const text = deEnt(m[3].replace(/<[^>]+>/g, '')).replace(/\n/g, ' ').trim()
    if (text) results.push({ text, offset: parseInt(m[1], 10), duration: parseInt(m[2], 10) })
  }
  if (results.length) return results
  const cRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
  while ((m = cRegex.exec(xml)) !== null) {
    const text = deEnt(m[3]).trim()
    if (text) results.push({ text, offset: Math.round(parseFloat(m[1]) * 1000), duration: Math.round(parseFloat(m[2]) * 1000) })
  }
  return results
}

function deEnt(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
}

function parseTracksFromHTML(html: string): CaptionTrack[] {
  const idx = html.indexOf('"captionTracks":')
  if (idx === -1) return []
  const slice = html.slice(idx + 16)
  let depth = 0, end = 0
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === '[') depth++
    else if (slice[i] === ']') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  if (!end) return []
  try { return JSON.parse(slice.slice(0, end)) as CaptionTrack[] } catch { return [] }
}

async function fetchCaptionXML(baseUrl: string, ua: string): Promise<string | null> {
  try {
    const res = await fetch(baseUrl, {
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const text = await res.text()
    return text.length > 0 ? text : null
  } catch { return null }
}

// --- Strategy 1: Innertube ---
async function viaInnertube(videoId: string, lang?: string) {
  const res = await fetch(INNERTUBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
    body: JSON.stringify({ videoId, context: { client: { clientName: 'ANDROID', clientVersion: CLIENT_VER } } }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const status: string = data?.playabilityStatus?.status ?? ''
  if (status === 'LOGIN_REQUIRED' || status === 'ERROR') return null

  const tracks: CaptionTrack[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) return null

  const target = pickTrack(tracks, lang)
  if (!target?.baseUrl) return null

  const xml = await fetchCaptionXML(target.baseUrl, ANDROID_UA)
  if (!xml) return null

  const segments = parseXML(xml)
  if (!segments.length) return null

  const vd = data?.videoDetails
  return {
    segments,
    language: target.languageCode,
    availableLanguages: buildLangList(tracks),
    title: vd?.title,
    channelName: vd?.author,
  }
}

// --- Strategy 2: HTML scraping with consent cookie bypass ---
async function viaHTMLScrape(videoId: string, lang?: string) {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': CONSENT_COOKIE },
    signal: AbortSignal.timeout(10000),
  })
  if (!pageRes.ok) return null
  const html = await pageRes.text()
  if (html.includes('class="g-recaptcha"')) return null  // rate limited

  const tracks = parseTracksFromHTML(html)
  if (!tracks.length) return null

  const target = pickTrack(tracks, lang)
  if (!target?.baseUrl) return null

  const xml = await fetchCaptionXML(target.baseUrl, BROWSER_UA)
  if (!xml) return null

  const segments = parseXML(xml)
  if (!segments.length) return null

  return {
    segments,
    language: target.languageCode,
    availableLanguages: buildLangList(tracks),
    title: undefined as string | undefined,
    channelName: undefined as string | undefined,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, lang } = body

    if (!url || typeof url !== 'string')
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const videoId = extractVideoId(url)
    if (!videoId)
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })

    // Run oEmbed and transcript fetch in parallel (oEmbed works from any IP)
    const [oEmbed, result] = await Promise.all([
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        signal: AbortSignal.timeout(5000),
      }).then((r) => r.ok ? r.json() : null).catch(() => null),
      // Try Innertube first, fall back to HTML scraping
      viaInnertube(videoId, lang).then(async (r) => r ?? viaHTMLScrape(videoId, lang)),
    ])

    if (!result)
      return NextResponse.json({ error: 'No captions available for this video' }, { status: 404 })

    return NextResponse.json({
      videoId,
      title: result.title ?? oEmbed?.title ?? 'Untitled Video',
      channelName: result.channelName ?? oEmbed?.author_name ?? 'Unknown Channel',
      language: result.language,
      availableLanguages: result.availableLanguages,
      segments: result.segments,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

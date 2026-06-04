import type { TranscriptEntry, ExportData, Segment } from '@/types/transcript'
import { formatTime } from './utils'

// ---- Shared paragraph grouping (used by viewer + export) ----
export interface Paragraph {
  startOffset: number
  text: string
}

export function groupIntoParagraphs(segments: Segment[]): Paragraph[] {
  if (!segments.length) return []
  const PAUSE = 1200
  const MIN = 3
  const MAX = 15
  const out: Paragraph[] = []
  let cur: Segment[] = [segments[0]]

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1]
    const curr = segments[i]
    const gap = curr.offset - (prev.offset + prev.duration)
    if ((gap > PAUSE && cur.length >= MIN) || cur.length >= MAX) {
      out.push({ startOffset: cur[0].offset, text: cur.map((s) => s.text).join(' ') })
      cur = [curr]
    } else {
      cur.push(curr)
    }
  }
  if (cur.length) out.push({ startOffset: cur[0].offset, text: cur.map((s) => s.text).join(' ') })
  return out
}

export function toJSONSingle(entry: TranscriptEntry): string {
  const data: ExportData = { version: 1, exportedAt: new Date().toISOString(), transcripts: [entry] }
  return JSON.stringify(data, null, 2)
}

export function toJSONAll(entries: TranscriptEntry[]): string {
  const data: ExportData = { version: 1, exportedAt: new Date().toISOString(), transcripts: entries }
  return JSON.stringify(data, null, 2)
}

export function toTXT(entry: TranscriptEntry): string {
  return [
    `TITLE: ${entry.title}`,
    `CHANNEL: ${entry.channelName}`,
    `URL: ${entry.url}`,
    `DATE: ${new Date(entry.createdAt).toLocaleDateString()}`,
    `DURATION: ${formatTime(entry.estimatedDuration)}`,
    `WORDS: ${entry.wordCount}`,
    '',
    '[TRANSCRIPT]',
    entry.fullText,
  ].join('\n')
}

export function toBeautifiedTXT(entry: TranscriptEntry): string {
  const divider = '═'.repeat(52)
  const paras = groupIntoParagraphs(entry.segments)
  const header = [
    divider,
    '  TUBESCRIPT — BEAUTIFIED TRANSCRIPT',
    divider,
    '',
    `  Title   : ${entry.title}`,
    `  Channel : ${entry.channelName}`,
    `  Duration: ${formatTime(entry.estimatedDuration)}  |  Words: ${entry.wordCount.toLocaleString()}`,
    `  Date    : ${new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    `  URL     : ${entry.url}`,
    '',
    divider,
  ].join('\n')

  const body = paras
    .map((p) => `\n[${formatTime(p.startOffset)}]\n${p.text}`)
    .join('\n')

  return header + '\n' + body
}

export function toSRT(entry: TranscriptEntry): string {
  return entry.segments
    .map((seg, i) => {
      const start = msToSRT(seg.offset)
      const end = msToSRT(seg.offset + seg.duration)
      return `${i + 1}\n${start} --> ${end}\n${seg.text}`
    })
    .join('\n\n')
}

function msToSRT(ms: number): string {
  const t = Math.max(0, ms)
  const h = Math.floor(t / 3600000)
  const m = Math.floor((t % 3600000) / 60000)
  const s = Math.floor((t % 60000) / 1000)
  const ms_ = t % 1000
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms_).padStart(3, '0')}`
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function safeFilename(title: string): string {
  return title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50)
}

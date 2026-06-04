export interface Segment {
  text: string
  offset: number
  duration: number
}

export interface TranscriptEntry {
  id: string
  videoId: string
  title: string
  channelName: string
  url: string
  thumbnail: string
  language: string
  segments: Segment[]
  fullText: string
  wordCount: number
  estimatedDuration: number
  createdAt: string
}

export interface ExportData {
  version: 1
  exportedAt: string
  transcripts: TranscriptEntry[]
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ImportResult {
  added: number
  skipped: number
}

export interface AvailableLang {
  code: string
  name: string
  isAuto: boolean
}

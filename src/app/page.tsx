'use client'

import { useState } from 'react'
import { Subtitles } from 'lucide-react'
import { toast } from 'sonner'
import { Navbar } from '@/components/Navbar'
import { URLInput } from '@/components/URLInput'
import { TranscriptViewer } from '@/components/TranscriptViewer'
import { HistoryPanel } from '@/components/HistoryPanel'
import { ImportButton } from '@/components/ImportButton'
import { TranscriptSkeleton } from '@/components/ui/Skeleton'
import { useTranscriptStore } from '@/store/transcripts.store'
import type { TranscriptEntry, FetchStatus, Segment, AvailableLang } from '@/types/transcript'
import { countWords } from '@/lib/utils'

export default function Home() {
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [activeTranscript, setActiveTranscript] = useState<TranscriptEntry | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [availableLanguages, setAvailableLanguages] = useState<AvailableLang[]>([])
  const [activeLang, setActiveLang] = useState<string>('')
  const [langSwitching, setLangSwitching] = useState(false)

  const store = useTranscriptStore()

  async function handleSubmit(url: string) {
    setStatus('loading')
    setError(null)
    setAvailableLanguages([])
    setActiveLang('')

    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setStatus('error')
        return
      }

      const segments: Segment[] = data.segments
      const fullText = segments.map((s: Segment) => s.text).join(' ')
      const lastSeg = segments[segments.length - 1]

      const entry: TranscriptEntry = {
        id: crypto.randomUUID(),
        videoId: data.videoId,
        title: data.title,
        channelName: data.channelName,
        url,
        thumbnail: `https://img.youtube.com/vi/${data.videoId}/hqdefault.jpg`,
        language: data.language,
        segments,
        fullText,
        wordCount: countWords(fullText),
        estimatedDuration: lastSeg ? lastSeg.offset + lastSeg.duration : 0,
        createdAt: new Date().toISOString(),
      }

      store.add(entry)
      store.setActive(entry.id)
      setActiveTranscript(entry)
      setAvailableLanguages(data.availableLanguages ?? [])
      setActiveLang(data.language ?? '')
      setStatus('success')
      toast.success('Transcript fetched!')
    } catch {
      setError('Network error — check your connection')
      setStatus('error')
    }
  }

  async function handleLangChange(newLang: string) {
    if (!activeTranscript || langSwitching || newLang === activeLang) return
    setLangSwitching(true)
    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeTranscript.url, lang: newLang }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Language not available'); return }

      const segments: Segment[] = data.segments
      const fullText = segments.map((s: Segment) => s.text).join(' ')
      const lastSeg = segments[segments.length - 1]

      const updated: TranscriptEntry = {
        ...activeTranscript,
        language: newLang,
        segments,
        fullText,
        wordCount: countWords(fullText),
        estimatedDuration: lastSeg ? lastSeg.offset + lastSeg.duration : activeTranscript.estimatedDuration,
      }

      store.add(updated)
      store.setActive(updated.id)
      setActiveTranscript(updated)
      setActiveLang(newLang)
      toast.success(`Switched to ${availableLanguages.find((l) => l.code === newLang)?.name ?? newLang}`)
    } catch {
      toast.error('Failed to switch language')
    } finally {
      setLangSwitching(false)
    }
  }

  function handleHistorySelect(entry: TranscriptEntry) {
    setActiveTranscript(entry)
    store.setActive(entry.id)
    setHistoryOpen(false)
    setStatus('success')
    setError(null)
    setAvailableLanguages([])
    setActiveLang(entry.language)
  }

  return (
    <main className="aurora min-h-screen">
      <Navbar
        onHistoryOpen={() => setHistoryOpen(true)}
        historyCount={store.transcripts.length}
      />

      <div className="mx-auto w-full max-w-2xl px-4 pt-28 pb-20">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] mb-3">
            YouTube Transcriber
          </h1>
          <p className="text-[var(--text-muted)] text-base">
            Paste any YouTube URL and get the full transcript in seconds.
          </p>
        </div>

        {/* URL Input */}
        <URLInput status={status} error={error} onSubmit={handleSubmit} />

        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          Supports youtube.com/watch, youtu.be, Shorts, and embed URLs
        </p>

        {/* Transcript area */}
        <div className="mt-10">
          {status === 'loading' && <TranscriptSkeleton />}

          {(status === 'success' || (status === 'error' && activeTranscript)) && activeTranscript && (
            <TranscriptViewer
              transcript={activeTranscript}
              availableLanguages={availableLanguages}
              activeLang={activeLang}
              langSwitching={langSwitching}
              onLangChange={handleLangChange}
            />
          )}

          {status === 'idle' && store.transcripts.length === 0 && (
            <EmptyState onImport={() => setHistoryOpen(true)} />
          )}

          {status === 'idle' && store.transcripts.length > 0 && !activeTranscript && (
            <RecentHint onHistoryOpen={() => setHistoryOpen(true)} count={store.transcripts.length} />
          )}
        </div>
      </div>

      {/* Import button — bottom left */}
      <div className="fixed bottom-4 left-4 z-30">
        <ImportButton />
      </div>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleHistorySelect}
      />
    </main>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
      <Subtitles size={32} className="text-[var(--border)]" />
      <p className="text-sm text-[var(--text-muted)]">Paste a YouTube URL above to get started</p>
      <button onClick={onImport} className="text-xs text-[var(--accent)] hover:underline">
        or import a backup file
      </button>
    </div>
  )
}

function RecentHint({ onHistoryOpen, count }: { onHistoryOpen: () => void; count: number }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
      <p className="text-sm text-[var(--text-muted)]">
        {count} saved transcript{count !== 1 ? 's' : ''} in history.
      </p>
      <button onClick={onHistoryOpen} className="text-sm text-[var(--accent)] hover:underline">
        View history →
      </button>
    </div>
  )
}

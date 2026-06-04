'use client'

import { useState, useMemo } from 'react'
import { Search, Copy, Check, Clock, Hash, Globe, ExternalLink, List, AlignJustify } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TranscriptEntry, AvailableLang } from '@/types/transcript'
import { formatTime, formatDate } from '@/lib/utils'
import { groupIntoParagraphs, type Paragraph } from '@/lib/export'
import { ExportMenu } from './ExportMenu'
import { cn } from '@/lib/utils'
import { Spinner } from './ui/Spinner'

type View = 'segments' | 'paragraph'

interface TranscriptViewerProps {
  transcript: TranscriptEntry
  availableLanguages?: AvailableLang[]
  activeLang?: string
  langSwitching?: boolean
  onLangChange?: (code: string) => void
}

export function TranscriptViewer({
  transcript,
  availableLanguages = [],
  activeLang = '',
  langSwitching = false,
  onLangChange,
}: TranscriptViewerProps) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<View>('segments')

  const paragraphs = useMemo(() => groupIntoParagraphs(transcript.segments), [transcript.segments])

  const filteredSegments = useMemo(() => {
    if (!query.trim()) return transcript.segments
    const q = query.toLowerCase()
    return transcript.segments.filter((s) => s.text.toLowerCase().includes(q))
  }, [transcript.segments, query])

  const filteredParagraphs = useMemo(() => {
    if (!query.trim()) return paragraphs
    const q = query.toLowerCase()
    return paragraphs.filter((p) => p.text.toLowerCase().includes(q))
  }, [paragraphs, query])

  const matchCount = query.trim()
    ? view === 'segments'
      ? filteredSegments.length
      : filteredParagraphs.length
    : null

  async function handleCopy() {
    await navigator.clipboard.writeText(transcript.fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${transcript.videoId}/hqdefault.jpg`
  const watchUrl = `https://www.youtube.com/watch?v=${transcript.videoId}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
    >
      {/* Header with thumbnail */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={transcript.title}
          className="absolute inset-0 w-full h-full object-cover scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black/80" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1">
            <h2 className="text-white font-semibold text-base leading-tight line-clamp-1 group-hover:underline">
              {transcript.title}
            </h2>
            <ExternalLink size={12} className="text-white/60 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <p className="text-white/70 text-sm mt-0.5">{transcript.channelName}</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-raised)]">
        <StatBadge icon={Hash} label={`${transcript.wordCount.toLocaleString()} words`} />
        <StatBadge icon={Clock} label={formatTime(transcript.estimatedDuration)} />

        {/* Language selector */}
        {availableLanguages.length > 1 ? (
          <div className="flex items-center gap-1.5">
            <Globe size={12} className="text-[var(--text-muted)]" />
            <div className="flex items-center gap-1">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  disabled={langSwitching}
                  onClick={() => onLangChange?.(lang.code)}
                  title={lang.isAuto ? `${lang.name} (auto-generated)` : lang.name}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all border',
                    activeLang === lang.code
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                    langSwitching && activeLang !== lang.code && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {langSwitching && activeLang === lang.code ? (
                    <Spinner className="size-2.5" />
                  ) : null}
                  {lang.code.toUpperCase()}
                  {lang.isAuto && <span className="opacity-60">·auto</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <StatBadge icon={Globe} label={transcript.language.toUpperCase()} />
        )}

        <span className="ml-auto text-xs text-[var(--text-muted)]">{formatDate(transcript.createdAt)}</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] pl-8 pr-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
          />
          {matchCount !== null && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
              {matchCount} {view === 'segments' ? 'match' + (matchCount !== 1 ? 'es' : '') : 'paragraph' + (matchCount !== 1 ? 's' : '')}
            </span>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-0.5 shrink-0">
          <button
            onClick={() => setView('segments')}
            title="Timestamps view"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
              view === 'segments'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            )}
          >
            <List size={13} />
            <span>Segments</span>
          </button>
          <button
            onClick={() => setView('paragraph')}
            title="Beautified paragraph view"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
              view === 'paragraph'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            )}
          >
            <AlignJustify size={13} />
            <span>Beautify</span>
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <ExportMenu transcript={transcript} />
      </div>

      {/* Content */}
      <div className="max-h-[520px] overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          {view === 'segments' ? (
            <motion.div key="segments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {filteredSegments.length === 0 ? (
                <EmptySearch query={query} />
              ) : (
                filteredSegments.map((seg, i) => (
                  <SegmentRow key={i} text={seg.text} offset={seg.offset} videoId={transcript.videoId} query={query} index={i} />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="paragraph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {filteredParagraphs.length === 0 ? (
                <EmptySearch query={query} />
              ) : (
                <div className="px-6 py-5 space-y-6">
                  {filteredParagraphs.map((para, i) => (
                    <ParagraphBlock key={i} para={para} videoId={transcript.videoId} query={query} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function ParagraphBlock({
  para,
  videoId,
  query,
  index,
}: {
  para: Paragraph
  videoId: string
  query: string
  index: number
}) {
  const seconds = Math.floor(para.startOffset / 1000)
  const highlighted = query.trim() ? highlightText(para.text, query) : para.text

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.25 }}
      className="group"
    >
      <a
        href={`https://www.youtube.com/watch?v=${videoId}&t=${seconds}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mb-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
      >
        {formatTime(para.startOffset)}
        <ExternalLink size={9} className="opacity-60" />
      </a>
      <p
        className="text-sm leading-7 text-[var(--text)] tracking-wide"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </motion.div>
  )
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="py-12 text-center text-sm text-[var(--text-muted)]">
      No results for &ldquo;{query}&rdquo;
    </div>
  )
}

function StatBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <Icon size={12} />
      <span>{label}</span>
    </div>
  )
}

function SegmentRow({
  text,
  offset,
  videoId,
  query,
  index,
}: {
  text: string
  offset: number
  videoId: string
  query: string
  index: number
}) {
  const timestamp = formatTime(offset)
  const seconds = Math.floor(offset / 1000)
  const highlighted = query.trim() ? highlightText(text, query) : text

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.008, 0.3), duration: 0.2 }}
      className="group flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--surface-raised)] transition-colors"
    >
      <a
        href={`https://www.youtube.com/watch?v=${videoId}&t=${seconds}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 font-mono text-xs text-[var(--accent)] hover:underline mt-0.5 tabular-nums"
      >
        {timestamp}
      </a>
      <p
        className="text-sm text-[var(--text)] leading-relaxed font-mono"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </motion.div>
  )
}

function highlightText(text: string, query: string): string {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:rgba(99,102,241,0.2);border-radius:2px;padding:0 2px">$1</mark>'
  )
}

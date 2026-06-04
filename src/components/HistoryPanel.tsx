'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Search, Clock, Hash, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TranscriptEntry } from '@/types/transcript'
import { useTranscriptStore } from '@/store/transcripts.store'
import { formatTime, formatDate } from '@/lib/utils'

interface HistoryPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (entry: TranscriptEntry) => void
}

export function HistoryPanel({ open, onClose, onSelect }: HistoryPanelProps) {
  const { transcripts, remove, clear, activeId } = useTranscriptStore()
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // Close on escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const filtered = query.trim()
    ? transcripts.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.channelName.toLowerCase().includes(query.toLowerCase())
      )
    : transcripts

  function handleClear() {
    if (confirmClear) {
      clear()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm border-l border-[var(--border)] bg-[var(--surface)] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="font-semibold text-[var(--text)]">History</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''} saved
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search history…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] pl-8 pr-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-muted)]">
                  <Clock size={32} className="opacity-30" />
                  <p className="text-sm">{query ? 'No matches' : 'No history yet'}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {filtered.map((entry) => (
                    <HistoryCard
                      key={entry.id}
                      entry={entry}
                      active={entry.id === activeId}
                      onSelect={() => onSelect(entry)}
                      onDelete={() => remove(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {transcripts.length > 0 && (
              <div className="px-4 py-3 border-t border-[var(--border)]">
                <button
                  onClick={handleClear}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition-colors hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 text-[var(--text-muted)]"
                >
                  {confirmClear ? (
                    <>
                      <AlertTriangle size={14} />
                      Click again to confirm clear all
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Clear all history
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function HistoryCard({
  entry,
  active,
  onSelect,
  onDelete,
}: {
  entry: TranscriptEntry
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const thumbnail = `https://img.youtube.com/vi/${entry.videoId}/mqdefault.jpg`

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-[var(--surface-raised)] ${
        active ? 'bg-[var(--accent)]/5 border-l-2 border-[var(--accent)]' : ''
      }`}
      onClick={onSelect}
    >
      <img
        src={thumbnail}
        alt={entry.title}
        className="size-14 rounded-lg object-cover shrink-0 bg-[var(--surface-raised)]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] line-clamp-2 leading-snug">{entry.title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{entry.channelName}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Hash size={10} />
            {entry.wordCount.toLocaleString()}w
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock size={10} />
            {formatTime(entry.estimatedDuration)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">{formatDate(entry.createdAt)}</span>
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-md text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

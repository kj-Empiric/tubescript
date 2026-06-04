'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, FileJson, FileText, Subtitles, Database, AlignJustify } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TranscriptEntry } from '@/types/transcript'
import { toJSONSingle, toJSONAll, toTXT, toSRT, toBeautifiedTXT, downloadFile, safeFilename } from '@/lib/export'
import { useTranscriptStore } from '@/store/transcripts.store'
import { cn } from '@/lib/utils'

interface ExportMenuProps {
  transcript: TranscriptEntry
}

export function ExportMenu({ transcript }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allTranscripts = useTranscriptStore((s) => s.transcripts)
  const base = safeFilename(transcript.title)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const actions = [
    {
      label: 'Export as JSON',
      icon: FileJson,
      action: () => downloadFile(toJSONSingle(transcript), `${base}.json`, 'application/json'),
    },
    {
      label: 'Export as TXT',
      icon: FileText,
      action: () => downloadFile(toTXT(transcript), `${base}.txt`, 'text/plain'),
    },
    {
      label: 'Export as SRT',
      icon: Subtitles,
      action: () => downloadFile(toSRT(transcript), `${base}.srt`, 'text/plain'),
    },
    {
      label: 'Export as Beautified',
      icon: AlignJustify,
      action: () => downloadFile(toBeautifiedTXT(transcript), `${base}_beautified.txt`, 'text/plain'),
      badge: 'NEW',
    },
    {
      label: 'Export all history',
      icon: Database,
      action: () => downloadFile(toJSONAll(allTranscripts), 'tubescript_backup.json', 'application/json'),
      divider: true,
    },
  ]

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors',
          open && 'text-[var(--text)]'
        )}
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/10 overflow-hidden"
          >
            {actions.map(({ label, icon: Icon, action, divider, badge }) => (
              <div key={label}>
                {divider && <div className="my-1 border-t border-[var(--border)]" />}
                <button
                  onClick={() => { action(); setOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors text-left"
                >
                  <Icon size={14} className="text-[var(--text-muted)]" />
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <span className="rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                      {badge}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

'use client'

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { ExportData } from '@/types/transcript'
import { useTranscriptStore } from '@/store/transcripts.store'

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const importAll = useTranscriptStore((s) => s.importAll)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data: ExportData = JSON.parse(ev.target?.result as string)
        if (data.version !== 1 || !Array.isArray(data.transcripts)) {
          toast.error('Invalid file format')
          return
        }
        const { added, skipped } = importAll(data.transcripts)
        if (added === 0) {
          toast.info('All transcripts already in history')
        } else {
          toast.success(`Imported ${added} transcript${added !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`)
        }
      } catch {
        toast.error('Failed to parse file — make sure it\'s a valid TubeScript export')
      }
    }
    reader.readAsText(file)
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
      >
        <Upload size={14} />
        Import
      </button>
    </>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { Spinner } from './ui/Spinner'
import type { FetchStatus } from '@/types/transcript'

interface URLInputProps {
  status: FetchStatus
  error: string | null
  onSubmit: (url: string) => void
}

export function URLInput({ status, error, onSubmit }: URLInputProps) {
  const [url, setUrl] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || status === 'loading') return
    onSubmit(trimmed)
  }

  const loading = status === 'loading'

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      <form onSubmit={handleSubmit}>
        <div className="relative group">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            disabled={loading}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 pr-14 text-[var(--text)] placeholder:text-[var(--text-muted)] text-base outline-none transition-all duration-200 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner className="size-4" /> : <ArrowRight size={16} />}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-500">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

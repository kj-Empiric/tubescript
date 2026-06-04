'use client'

import { History, Subtitles } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface NavbarProps {
  onHistoryOpen: () => void
  historyCount: number
}

export function Navbar({ onHistoryOpen, historyCount }: NavbarProps) {
  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl">
      <nav className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 backdrop-blur-xl shadow-lg shadow-black/5">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--accent)]">
            <Subtitles size={14} className="text-white" />
          </div>
          <span className="font-semibold text-[var(--text)] tracking-tight">TubeScript</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onHistoryOpen}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
          >
            <History size={15} />
            <span>History</span>
            {historyCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-medium text-white">
                {historyCount > 99 ? '99+' : historyCount}
              </span>
            )}
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}

'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TranscriptEntry } from '@/types/transcript'

interface TranscriptStore {
  transcripts: TranscriptEntry[]
  activeId: string | null
  add: (entry: TranscriptEntry) => void
  remove: (id: string) => void
  clear: () => void
  setActive: (id: string | null) => void
  importAll: (entries: TranscriptEntry[]) => { added: number; skipped: number }
  getByVideoId: (videoId: string) => TranscriptEntry | undefined
  getActive: () => TranscriptEntry | undefined
}

export const useTranscriptStore = create<TranscriptStore>()(
  persist(
    (set, get) => ({
      transcripts: [],
      activeId: null,

      add: (entry) =>
        set((s) => ({
          transcripts: [entry, ...s.transcripts.filter((t) => t.videoId !== entry.videoId)],
        })),

      remove: (id) =>
        set((s) => ({
          transcripts: s.transcripts.filter((t) => t.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      clear: () => set({ transcripts: [], activeId: null }),

      setActive: (id) => set({ activeId: id }),

      importAll: (entries) => {
        const existing = new Set(get().transcripts.map((t) => t.videoId))
        const fresh = entries.filter((e) => !existing.has(e.videoId))
        set((s) => ({ transcripts: [...fresh, ...s.transcripts] }))
        return { added: fresh.length, skipped: entries.length - fresh.length }
      },

      getByVideoId: (videoId) => get().transcripts.find((t) => t.videoId === videoId),

      getActive: () => {
        const { transcripts, activeId } = get()
        return transcripts.find((t) => t.id === activeId)
      },
    }),
    { name: 'tubescript:v1' }
  )
)

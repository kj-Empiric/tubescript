const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

export function extractVideoId(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && VIDEO_ID_PATTERN.test(id) ? id : null
    }

    if (host.endsWith('youtube.com')) {
      const watchId = url.searchParams.get('v')
      if (watchId && VIDEO_ID_PATTERN.test(watchId)) return watchId

      const parts = url.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex(p => ['embed', 'shorts', 'live'].includes(p))
      const id = idx >= 0 ? parts[idx + 1] : null
      return id && VIDEO_ID_PATTERN.test(id) ? id : null
    }

    return null
  } catch {
    return null
  }
}

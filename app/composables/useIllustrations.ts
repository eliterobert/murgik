import { artIdentity } from '#shared/game/art'
import type { Illustration } from '#shared/game/art'
import type { CardDraft } from '#shared/game/types'
export function useIllustrations() {
  const library = useState<Record<string, Illustration>>('murgik-illustrations', () => ({}))
  const activePolls = new Set<string>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let disposed = false
  function remember(card: CardDraft, illustration: Illustration) {
    const key = artIdentity(card)
    library.value[key] = illustration
    if (!illustration.id || !['queued', 'generating'].includes(illustration.status) || activePolls.has(key)) return
    activePolls.add(key)
    const started = Date.now()
    const poll = async () => {
      try {
        const next = await $fetch<Illustration>(`/api/art/${illustration.id}`, { retry: 0 })
        if (disposed) return
        library.value[key] = next
        if (['queued', 'generating'].includes(next.status) && Date.now() - started < 180_000) {
          const timer = setTimeout(() => { timers.delete(timer); void poll() }, 1800)
          timers.add(timer)
        } else {
          activePolls.delete(key)
          if (['queued', 'generating'].includes(next.status)) library.value[key] = { ...next, status: 'failed', message: 'Illustrationen dröjer. Kortet går fortfarande att spela.' }
        }
      } catch {
        library.value[key] = { ...illustration, status: 'failed', message: 'Bildanslutningen bröts. Originalillustrationen används.' }
        activePolls.delete(key)
      }
    }
    const timer = setTimeout(() => { timers.delete(timer); void poll() }, 1200)
    timers.add(timer)
  }
  onBeforeUnmount(() => { disposed = true; for (const timer of timers) clearTimeout(timer); activePolls.clear() })
  return { library, remember }
}

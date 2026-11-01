import { artIdentity } from '#shared/game/art'
import type { Illustration } from '#shared/game/art'
import type { CardDraft } from '#shared/game/types'

/** Rendering and remembering never call a generation or polling endpoint. */
export function useIllustrations() {
  const library = useState<Record<string, Illustration>>('murgik-illustrations', () => ({}))
  function remember(card: CardDraft, illustration: Illustration) {
    library.value[artIdentity(card)] = illustration
  }
  function clear() { library.value = {} }
  return { library, remember, clear }
}

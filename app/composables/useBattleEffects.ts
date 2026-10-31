import { battleEvents } from '#shared/game/presentation'
import type { BattleEvent } from '#shared/game/presentation'
import type { Action, GameState } from '#shared/game/types'
export interface PositionedEvent extends BattleEvent { id: number; x: number; y: number; width: number; height: number; fromX?: number; fromY?: number }
export function useBattleEffects() {
  const effects = ref<PositionedEvent[]>([])
  const turnBanner = ref('')
  const botCard = shallowRef<BattleEvent['card'] | null>(null)
  const botMessage = ref('')
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let sequence = 0
  function later(fn: () => void, duration: number) {
    const timer = setTimeout(() => { timers.delete(timer); fn() }, duration); timers.add(timer)
  }
  function positions() {
    const rects = new Map<string, DOMRect>()
    document.querySelectorAll<HTMLElement>('[data-entity-id]').forEach(el => { if (el.dataset.entityId) rects.set(el.dataset.entityId, el.getBoundingClientRect()) })
    return rects
  }
  function capture(before: GameState, after: GameState, action: Action) {
    const events = battleEvents(before, after, action), rects = positions()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (action.type === 'resolve') {
      for (const event of events.filter(e => e.kind === 'attack')) {
        const el = [...document.querySelectorAll<HTMLElement>('[data-entity-id]')].find(el => el.dataset.entityId === event.entityId)
        if (el && !reduced) el.animate([{ transform: 'translateY(0) scale(1)' }, { transform: `translateY(${event.side === 'you' ? '-52px' : '52px'}) scale(1.08)`, offset: .42 }, { transform: 'translateY(0) scale(1)' }], { duration: 430, easing: 'cubic-bezier(.25,.7,.25,1)' })
      }
    }
    if (after.active !== before.active) {
      turnBanner.value = after.active === 'you' ? `Din tur · ${after.players.you.maxMana} mana` : 'Veyras tur'
      const current = turnBanner.value; later(() => { if (turnBanner.value === current) turnBanner.value = '' }, 1600)
    }
    const played = events.find(e => e.card && ['summon', 'spell'].includes(e.kind))
    if (action.side === 'bot') {
      if (played) { botCard.value = played.card; botMessage.value = `Veyra spelar ${played.card!.name}`; const id = played.card!.id; later(() => { if (botCard.value?.id === id) botCard.value = null }, 1900) }
      else if (action.type === 'attack') botMessage.value = `Veyra anfaller med ${action.attackers.length} ${action.attackers.length === 1 ? 'varelse' : 'varelser'}`
      else if (action.type === 'block') botMessage.value = 'Veyra väljer en blockerare'
    }
    void nextTick(() => {
      const currentRects = positions()
      for (const event of events) {
        if (['draw', 'forge', 'attack'].includes(event.kind)) continue
        const rect = rects.get(event.entityId) ?? currentRects.get(event.entityId)
        if (!rect) continue
        const from = event.sourceId ? rects.get(event.sourceId) : undefined
        const id = ++sequence
        effects.value.push({ ...event, id, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height, fromX: from ? from.x + from.width / 2 : undefined, fromY: from ? from.y + from.height / 2 : undefined })
        later(() => { effects.value = effects.value.filter(e => e.id !== id) }, reduced ? 450 : 1050)
      }
    })
    return events
  }
  function clear() { for (const timer of timers) clearTimeout(timer); timers.clear(); effects.value = []; turnBanner.value = ''; botCard.value = null; botMessage.value = '' }
  onBeforeUnmount(clear)
  return { effects, turnBanner, botCard, botMessage, capture, clear }
}

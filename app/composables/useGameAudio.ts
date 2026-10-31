import { SamplePlayer } from '../utils/sample-player'
import { AUDIO_FILES } from '#shared/audio/library'
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS, readAudioSettings } from '#shared/audio/settings'
import type { Sound } from '#shared/audio/cues'

/** Preserve the existing opt-in/mute interface while playing locally cached licensed recordings. */
export function useGameAudio() {
  const settings = ref({ ...DEFAULT_AUDIO_SETTINGS })
  const muted = computed(() => settings.value.muted)
  const masterVolume = computed({ get: () => Math.round(settings.value.master * 100), set: (v: number) => { settings.value.master = Math.min(100, Math.max(0, Number(v))) / 100 } })
  const effectsVolume = computed({ get: () => Math.round(settings.value.effects * 100), set: (v: number) => { settings.value.effects = Math.min(100, Math.max(0, Number(v))) / 100 } })
  const unavailable = ref(false)
  const files = new Map<string, Promise<ArrayBuffer>>()
  let context: AudioContext | undefined, player: SamplePlayer | undefined, ready: Promise<void> | undefined
  let interacted = false, disposed = false, generation = 0
  const file = (url: string) => {
    if (!files.has(url)) files.set(url, fetch(url, { cache: 'force-cache', credentials: 'omit' }).then(response => { if (!response.ok) throw new Error('Audio asset unavailable'); return response.arrayBuffer() }))
    return files.get(url)!.then(data => data.slice(0))
  }
  function unlock(event?: Event) {
    if (disposed || (event && !event.isTrusted)) return
    interacted = true
    try {
      if (!context) {
        context = new AudioContext({ latencyHint: 'interactive' }); player = new SamplePlayer(context)
        player.setSettings(settings.value)
        ready = player.load(file).then(result => { if (!disposed) unavailable.value = result.failed.length > 0 })
      }
      if (!muted.value && context.state === 'suspended') void context.resume().catch(() => { unavailable.value = true })
    } catch { unavailable.value = true }
  }
  async function toggle() {
    unlock()
    settings.value.muted = !settings.value.muted
    player?.setSettings(settings.value)
    if (!settings.value.muted && context) {
      try { await context.resume(); play('select') } catch { unavailable.value = true }
    }
  }
  function play(sound: Sound, delay = 0) {
    if (!interacted || muted.value || disposed || !player) return
    const timestamp = performance.now(), version = generation
    // Never hold up gameplay; discard a cue if its assets were not ready within 180ms.
    void ready?.then(() => { if (!disposed && version === generation && !muted.value && context?.state === 'running' && performance.now() - timestamp < 180) player?.play(sound, delay) })
  }
  function stopAll() { generation++; player?.stopAll() }
  function stop(sound: Sound) { player?.stopSound(sound) }
  watch(settings, value => {
    player?.setSettings(value)
    if (value.muted) generation++
    if (import.meta.client) try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(value)) } catch { /* Storage is optional. */ }
  }, { deep: true })
  onMounted(() => {
    try { settings.value = readAudioSettings(localStorage.getItem(AUDIO_STORAGE_KEY)) } catch { /* Keep muted defaults. */ }
    // Loading local files is silent. AudioContext and playback wait for a real interaction.
    for (const filename of Object.values(AUDIO_FILES)) void file(`/audio/${filename}`).catch(() => { unavailable.value = true })
    window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true)
  })
  onBeforeUnmount(() => {
    disposed = true; generation++; window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true)
    player?.dispose(); if (context && context.state !== 'closed') void context.close().catch(() => {})
  })
  return { muted, toggle, play, stopAll, stop, masterVolume, effectsVolume, unavailable }
}

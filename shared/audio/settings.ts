export interface AudioSettings { muted: boolean; master: number; effects: number }
export const AUDIO_STORAGE_KEY = 'murgik-audio-v1'
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { muted: true, master: .8, effects: .8 }
export function audioSettings(input: unknown): AudioSettings {
  const value = input && typeof input === 'object' ? input as Partial<AudioSettings> : {}
  const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
  return { muted: typeof value.muted === 'boolean' ? value.muted : true, master: volume(value.master, .8), effects: volume(value.effects, .8) }
}
export function readAudioSettings(raw: string | null): AudioSettings {
  try { return audioSettings(raw ? JSON.parse(raw) : null) } catch { return { ...DEFAULT_AUDIO_SETTINGS } }
}

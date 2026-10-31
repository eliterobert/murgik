import { AUDIO_FILES, SOUND_LAYERS, SOUND_PRIORITY } from '#shared/audio/library'
import type { AudioAsset, SoundLayer } from '#shared/audio/library'
import type { Sound } from '#shared/audio/cues'
import type { AudioSettings } from '#shared/audio/settings'
export const MAX_AUDIO_VOICES = 8
interface Voice { source: AudioBufferSourceNode; gain: GainNode; filter?: BiquadFilterNode; sound: Sound; priority: number }
export interface SampleAnalysis { peak: number; rms: number; gain: number; start: number; end: number }
export function analyseSample(buffer: AudioBuffer): SampleAnalysis {
  let peak = 0, square = 0, first = buffer.length, last = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      const value = Math.abs(data[i]!)
      peak = Math.max(peak, value); square += value * value
      if (value > .001) { first = Math.min(first, i); last = Math.max(last, i) }
    }
  }
  const rms = Math.sqrt(square / Math.max(1, buffer.length * buffer.numberOfChannels))
  return { peak, rms, gain: peak > 0 ? Math.min(4, .88 / peak, .16 / Math.max(rms, .0001)) : 0, start: Math.max(0, first / buffer.sampleRate - .008), end: Math.min(buffer.duration, (last + 1) / buffer.sampleRate + .025) }
}
/** One central, bounded sample mixer. No synthesis, timers, remote URLs or rules dependencies. */
export class SamplePlayer {
  private buffers = new Map<AudioAsset, { buffer: AudioBuffer; analysis: SampleAnalysis }>()
  private reversed = new Map<AudioAsset, AudioBuffer>()
  private voices = new Set<Voice>()
  private lastPlayed = new Map<Sound, number>()
  private master: GainNode
  private effects: GainNode
  private compressor: DynamicsCompressorNode
  private limiter: WaveShaperNode
  private muted = true
  private closed = false
  constructor(private context: BaseAudioContext) {
    this.master = context.createGain(); this.effects = context.createGain()
    this.compressor = context.createDynamicsCompressor(); this.limiter = context.createWaveShaper()
    this.master.gain.value = 0; this.effects.gain.value = .8
    this.compressor.threshold.value = -12; this.compressor.knee.value = 12; this.compressor.ratio.value = 12
    this.compressor.attack.value = .003; this.compressor.release.value = .15
    const curve = new Float32Array(2049)
    for (let i = 0; i < curve.length; i++) { const x = i * 2 / (curve.length - 1) - 1; curve[i] = .9 * Math.tanh(1.1 * x) / Math.tanh(1.1) }
    this.limiter.curve = curve; this.limiter.oversample = '4x'
    this.effects.connect(this.compressor); this.compressor.connect(this.limiter); this.limiter.connect(this.master); this.master.connect(context.destination)
  }
  async load(fetchFile: (url: string) => Promise<ArrayBuffer>): Promise<{ loaded: number; failed: string[] }> {
    const failed: string[] = []
    await Promise.all(Object.entries(AUDIO_FILES).map(async ([key, filename]) => {
      try {
        const buffer = await this.context.decodeAudioData(await fetchFile(`/audio/${filename}`))
        if (!this.closed) this.buffers.set(key as AudioAsset, { buffer, analysis: analyseSample(buffer) })
      } catch { failed.push(filename) }
    }))
    return { loaded: this.buffers.size, failed }
  }
  setSettings(settings: AudioSettings) {
    this.muted = settings.muted
    const time = this.context.currentTime
    this.master.gain.cancelScheduledValues(time)
    if (settings.muted) { this.master.gain.setValueAtTime(0, time); this.stopAll() }
    else this.master.gain.setTargetAtTime(settings.master, time, .015)
    this.effects.gain.setTargetAtTime(settings.effects, time, .015)
  }
  play(sound: Sound, delay = 0): boolean {
    if (this.closed || this.muted) return false
    const now = this.context.currentTime, last = this.lastPlayed.get(sound) ?? -100
    const interval = sound === 'hover' ? .13 : sound === 'select' ? .06 : .045
    if (now - last < interval || (sound === 'hover' && this.voices.size >= 3)) return false
    if (sound === 'reveal') this.stopSound('forge')
    if (sound === 'victory' || sound === 'defeat') {
      this.stopSound('forge'); this.stopSound(sound === 'victory' ? 'defeat' : 'victory')
    }
    let started = false
    for (const layer of SOUND_LAYERS[sound]) started = this.layer(sound, layer, Math.max(0, delay)) || started
    if (started) this.lastPlayed.set(sound, now)
    return started
  }
  private layer(sound: Sound, layer: SoundLayer, delay: number): boolean {
    const sample = this.buffers.get(layer.asset)
    if (!sample || sample.analysis.gain <= 0) return false
    if (this.voices.size >= MAX_AUDIO_VOICES) {
      const oldest = [...this.voices].sort((a, b) => a.priority - b.priority)[0]!
      if (oldest.priority > SOUND_PRIORITY[sound]) return false
      this.stopVoice(oldest)
    }
    let buffer = sample.buffer
    if (layer.reverse) {
      if (!this.reversed.has(layer.asset)) {
        const reverse = this.context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) reverse.getChannelData(channel).set(buffer.getChannelData(channel).slice().reverse())
        this.reversed.set(layer.asset, reverse)
      }
      buffer = this.reversed.get(layer.asset)!
    }
    const source = this.context.createBufferSource(), gain = this.context.createGain()
    source.buffer = buffer; source.playbackRate.value = layer.rate ?? 1
    const offset = Math.min(buffer.duration - .01, layer.offset ?? (layer.reverse ? 0 : sample.analysis.start))
    const available = Math.max(.01, (layer.reverse ? buffer.duration : sample.analysis.end) - offset)
    const duration = Math.min(layer.duration ?? available / source.playbackRate.value, available / source.playbackRate.value)
    const start = this.context.currentTime + delay + (layer.delay ?? 0), end = start + duration
    const attack = Math.min(layer.attack ?? .006, duration * .45), release = Math.min(layer.release ?? .07, duration * .45)
    const level = .5 * Math.min(1, layer.gain) * sample.analysis.gain
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(level, start + attack)
    gain.gain.setValueAtTime(level, Math.max(start + attack, end - release)); gain.gain.linearRampToValueAtTime(0, end)
    source.connect(gain)
    let filter: BiquadFilterNode | undefined
    if (layer.lowpass) { filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = layer.lowpass; gain.connect(filter); filter.connect(this.effects) }
    else gain.connect(this.effects)
    const voice: Voice = { source, gain, filter, sound, priority: SOUND_PRIORITY[sound] }
    this.voices.add(voice)
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); filter?.disconnect() }
    source.start(start, offset, duration * source.playbackRate.value); source.stop(end + .01)
    return true
  }
  private stopVoice(voice: Voice) {
    voice.gain.gain.cancelScheduledValues(this.context.currentTime); voice.gain.gain.setValueAtTime(0, this.context.currentTime)
    try { voice.source.stop(this.context.currentTime) } catch { /* Already ended. */ }
    this.voices.delete(voice)
  }
  stopSound(sound: Sound) { for (const voice of [...this.voices]) if (voice.sound === sound) this.stopVoice(voice) }
  stopAll() { for (const voice of [...this.voices]) this.stopVoice(voice) }
  get activeVoices() { return this.voices.size }
  dispose() { this.closed = true; this.stopAll(); this.buffers.clear(); this.reversed.clear(); this.effects.disconnect(); this.compressor.disconnect(); this.limiter.disconnect(); this.master.disconnect() }
}

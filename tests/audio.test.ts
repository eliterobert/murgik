import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { AUDIO_FILES, SOUND_LAYERS } from '../shared/audio/library'
import { DEFAULT_AUDIO_SETTINGS, audioSettings, readAudioSettings } from '../shared/audio/settings'
import { actionSounds } from '../shared/audio/cues'
import { SamplePlayer, analyseSample, MAX_AUDIO_VOICES } from '../app/utils/sample-player'
import { act, createGame } from '../shared/game/engine'
import { battleEvents } from '../shared/game/presentation'
import type { Sound } from '../shared/audio/cues'

function buffer(data: number[] = [.0, .2, -.8, .1, .0]): AudioBuffer {
  const samples = Float32Array.from(data)
  return { length: samples.length, numberOfChannels: 1, sampleRate: 100, duration: samples.length / 100, getChannelData: () => samples } as unknown as AudioBuffer
}
class Parameter { value = 0; setValueAtTime(v: number) { this.value = v }; setTargetAtTime(v: number) { this.value = v }; linearRampToValueAtTime(v: number) { this.value = v }; cancelScheduledValues() {} }
class Node { gain = new Parameter(); frequency = new Parameter(); threshold = new Parameter(); knee = new Parameter(); ratio = new Parameter(); attack = new Parameter(); release = new Parameter(); playbackRate = new Parameter(); curve = null; oversample = ''; type = ''; buffer = null; onended?: () => void; connect() {}; disconnect() {}; start() {}; stop() {} }
class Context {
  currentTime = 0; destination = new Node(); sources: Node[] = []; decoded = 0
  createGain() { return new Node() }; createDynamicsCompressor() { return new Node() }; createWaveShaper() { return new Node() }; createBiquadFilter() { return new Node() }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node }
  createBuffer(channels: number, length: number, rate: number) { const data = new Float32Array(length); return { length, sampleRate: rate, duration: length / rate, numberOfChannels: channels, getChannelData: () => data } }
  async decodeAudioData() { this.decoded++; return buffer(Array.from({ length: 200 }, (_, i) => i % 2 ? .4 : -.4)) }
}
describe('licensed sample audio', () => {
  it('defaults to muted and sanitizes persisted settings', () => {
    expect(readAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(readAudioSettings('broken')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(audioSettings({ muted: false, master: 3, effects: -2 })).toEqual({ muted: false, master: 1, effects: 0 })
    expect(audioSettings({ muted: 'yes', master: NaN, effects: 'loud' })).toEqual(DEFAULT_AUDIO_SETTINGS)
    const saved = { muted: false, master: .47, effects: .63 }
    expect(readAudioSettings(JSON.stringify(saved))).toEqual(saved)
  })
  it('every deployed sample has a verified source, license, binary header and SHA-256', () => {
    const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8'))
    for (const filename of Object.values(AUDIO_FILES)) {
      const asset = manifest.files.find((entry: { file: string }) => entry.file === filename)
      expect(asset, filename).toBeTruthy()
      const path = resolve('public/audio', filename), bytes = readFileSync(path)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
      expect(['CC0 1.0', 'CC BY 3.0']).toContain(manifest.sources[asset.sourceId].license)
      expect(manifest.sources[asset.sourceId].page).toMatch(/^https:\/\/opengameart\.org\/content\//)
      const header = bytes.toString('ascii', 0, 4)
      expect(header === 'RIFF' || header === 'OggS' || header.startsWith('ID3') || bytes[0] === 255, filename).toBe(true)
    }
    expect(existsSync('public/audio/LICENSES.md')).toBe(true)
    expect(readFileSync('public/audio/LICENSES.md', 'utf8')).toContain('ViRiX Dreamcore')
  })
  it('all action cues use existing local recorded samples with bounded levels and durations', () => {
    for (const layers of Object.values(SOUND_LAYERS)) for (const layer of layers) {
      expect(AUDIO_FILES[layer.asset]).toBeTruthy(); expect(layer.gain).toBeGreaterThan(0); expect(layer.gain).toBeLessThanOrEqual(1)
      expect(layer.duration ?? 1).toBeLessThanOrEqual(4); expect(layer.rate ?? 1).toBeGreaterThan(.5)
    }
    expect(readFileSync('app/composables/useGameAudio.ts', 'utf8')).not.toContain('createOscillator')
    expect(readFileSync('app/utils/sample-player.ts', 'utf8')).not.toContain('createOscillator')
  })
  it('normalizes loud samples without amplifying silence and trims leading silence', () => {
    const analysis = analyseSample(buffer([0, 0, 0, 0, .1, -.95, .2, 0, 0]))
    expect(analysis.peak * analysis.gain).toBeLessThanOrEqual(.88001)
    expect(analysis.start).toBeGreaterThan(0)
    expect(analyseSample(buffer([0, 0, 0])).gain).toBe(0)
  })
  it('does not play before loaded/unmuted and bounds voices during action bursts', async () => {
    const context = new Context(), player = new SamplePlayer(context as unknown as BaseAudioContext)
    expect(player.play('attack')).toBe(false)
    const urls: string[] = []
    const result = await player.load(async url => { urls.push(url); return new ArrayBuffer(8) })
    expect(result.loaded).toBe(17); expect(urls.every(url => url.startsWith('/audio/'))).toBe(true)
    expect(player.play('attack')).toBe(false)
    player.setSettings({ muted: false, master: .8, effects: .8 })
    for (const sound of ['forge', 'attack', 'magic', 'death', 'damage', 'reveal'] as Sound[]) {
      context.currentTime += .2; player.play(sound)
      expect(player.activeVoices).toBeLessThanOrEqual(MAX_AUDIO_VOICES)
    }
    player.setSettings({ muted: true, master: .8, effects: .8 })
    expect(player.activeVoices).toBe(0); expect(player.play('victory')).toBe(false)
    player.dispose()
  })
  it('throttles hover and cancels scheduled build layers at reveal or stop', async () => {
    const context = new Context(), player = new SamplePlayer(context as unknown as BaseAudioContext)
    await player.load(async () => new ArrayBuffer(8)); player.setSettings({ muted: false, master: 1, effects: 1 })
    expect(player.play('hover')).toBe(true); expect(player.play('hover')).toBe(false)
    context.currentTime += .2; expect(player.play('hover')).toBe(true)
    player.stopAll(); player.play('forge'); expect(player.activeVoices).toBe(3)
    player.stopSound('forge'); expect(player.activeVoices).toBe(0)
    player.play('victory', .3); expect(player.activeVoices).toBe(2)
    player.stopAll(); expect(player.activeVoices).toBe(0)
  })
  it('keeps audio failures silent instead of synthesizing a fallback', async () => {
    const context = new Context(), player = new SamplePlayer(context as unknown as BaseAudioContext)
    const result = await player.load(async () => { throw new Error('offline') })
    player.setSettings({ muted: false, master: 1, effects: 1 })
    expect(result.failed).toHaveLength(17); expect(player.play('card')).toBe(false); expect(player.activeVoices).toBe(0)
  })
  it('lets a lethal attack finish underneath its delayed victory signature', async () => {
    const context = new Context(), player = new SamplePlayer(context as unknown as BaseAudioContext)
    await player.load(async () => new ArrayBuffer(8)); player.setSettings({ muted: false, master: .8, effects: .8 })
    player.play('attack'); expect(player.activeVoices).toBe(3)
    player.play('victory', .3); expect(player.activeVoices).toBe(5)
    player.stopAll(); expect(player.activeVoices).toBe(0)
  })
  it('maps draw, damage, death and victory once per action without altering game snapshots', () => {
    const before = createGame(); before.phase = 'main'
    before.players.you.hand[2] = { ...before.players.you.hand[2]!, type:'spell', cost:1, effects:[{kind:'damage',target:'enemy',amount:2,secondary:0,filter:'any'}] }
    const action = { type: 'play', side: 'you', cardId: before.players.you.hand[2]!.id, targetId: 'bot' } as const
    const after = act(before, action).state, original = structuredClone(before)
    const events = battleEvents(before, after, action)
    const sounds = actionSounds(before, after, action, [...events, ...events])
    expect(sounds.filter(cue => cue.sound === 'damage')).toHaveLength(1)
    expect(sounds.some(cue => cue.sound === 'magic')).toBe(true); expect(before).toEqual(original)
    after.winner = 'you'
    expect(actionSounds(before, after, action, events).some(cue => cue.sound === 'victory')).toBe(true)
  })
})

import type { Sound } from './cues'
export const AUDIO_FILES = {
  paper: 'card-draw.ogg', slide: 'card-slide.ogg', swift: 'whoosh-swift.wav', soft: 'whoosh-soft.wav',
  body: 'impact-body.ogg', sword: 'impact-sword.wav', hover: 'ui-hover.wav', select: 'ui-select.ogg',
  bell: 'reveal-bell.ogg', fire: 'magic-fire.wav', heal: 'magic-heal.wav', ice: 'magic-ice.wav',
  wind: 'magic-wind.wav', shimmer: 'magic-shimmer.wav', dissolve: 'death-dissolve.wav', victory: 'victory.mp3', defeat: 'defeat.mp3'
} as const
export type AudioAsset = keyof typeof AUDIO_FILES
export interface SoundLayer {
  asset: AudioAsset; gain: number; delay?: number; rate?: number; offset?: number; duration?: number
  attack?: number; release?: number; reverse?: boolean; lowpass?: number
}
export const SOUND_PRIORITY: Record<Sound, number> = { hover: 0, select: 1, draw: 2, turn: 2, card: 3, damage: 4, block: 4, magic: 5, attack: 5, death: 6, forge: 7, reveal: 8, victory: 9, defeat: 9 }
/** Layered licensed recordings, not oscillators. Envelopes keep cues short and tactile. */
export const SOUND_LAYERS: Record<Sound, readonly SoundLayer[]> = {
  draw: [{ asset: 'paper', gain: .8, rate: 1.04, duration: .42, release: .06 }],
  card: [
    { asset: 'slide', gain: .7, duration: .42 },
    { asset: 'soft', gain: .8, delay: .025, rate: .95 },
    { asset: 'shimmer', gain: .34, delay: .08, duration: .65, lowpass: 6500 },
    { asset: 'body', gain: .3, delay: .16, rate: .9, lowpass: 2200 }
  ],
  attack: [
    { asset: 'swift', gain: 1, rate: 1.05 },
    { asset: 'sword', gain: .85, delay: .115, rate: .88, duration: .6 },
    { asset: 'body', gain: .9, delay: .14, rate: .78, lowpass: 4500 }
  ],
  damage: [{ asset: 'body', gain: .7, rate: .94, duration: .24, lowpass: 4200 }],
  death: [
    { asset: 'dissolve', gain: .7, offset: .1, duration: 1.1, rate: 1.2, release: .55, lowpass: 6500 },
    { asset: 'ice', gain: .35, delay: .07, duration: .65, rate: .85, release: .3 }
  ],
  magic: [
    { asset: 'wind', gain: .65, duration: .65, rate: 1.1 },
    { asset: 'fire', gain: .65, delay: .1, duration: 1.1, release: .45 },
    { asset: 'shimmer', gain: .3, delay: .16, duration: .7, rate: .95 }
  ],
  forge: [
    { asset: 'wind', gain: .85, duration: 1.5, rate: .78, reverse: true, attack: .7, release: .3 },
    { asset: 'heal', gain: .85, delay: .15, offset: .1, duration: 2.3, rate: .78, attack: 1, release: .6 },
    { asset: 'fire', gain: .45, delay: .5, offset: .5, duration: 1.8, rate: .68, attack: .65, release: .5, lowpass: 4500 }
  ],
  reveal: [
    { asset: 'shimmer', gain: 1, rate: .85, duration: 1.3, release: .5 },
    { asset: 'bell', gain: .46, delay: .12, rate: .92, duration: 1.5, release: .65 },
    { asset: 'fire', gain: .55, delay: .04, duration: .85, release: .4, lowpass: 4500 }
  ],
  turn: [
    { asset: 'soft', gain: .4, rate: .72, duration: .55, release: .16 },
    { asset: 'shimmer', gain: .2, delay: .04, rate: .8, duration: .6, attack: .08, release: .25 }
  ],
  hover: [{ asset: 'hover', gain: .16, rate: 1.25, duration: .065, release: .035, lowpass: 3500 }],
  select: [{ asset: 'select', gain: .5, duration: .18, release: .07, lowpass: 5000 }],
  block: [{ asset: 'sword', gain: .7, rate: 1.1, duration: .43, release: .2 }, { asset: 'soft', gain: .3, duration: .22 }],
  victory: [{ asset: 'victory', gain: .9, duration: 3.7, attack: .04, release: .8 }, { asset: 'shimmer', gain: .4, duration: 1.2, release: .5 }],
  defeat: [{ asset: 'defeat', gain: .82, duration: 3.3, attack: .04, release: .8 }, { asset: 'dissolve', gain: .22, duration: .9, release: .5 }]
}

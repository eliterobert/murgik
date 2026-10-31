# Murgik — sound credits and licenses

Some of the sounds in this project were created by **ViRiX Dreamcore (David Mckee)** — [www.soundcloud.com/virix](https://www.soundcloud.com/virix).

The five magic WAV samples are from [Magic SFX Sample](https://opengameart.org/content/magic-sfx-sample), used under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/). Source files are unmodified and renamed. Playback layers, trims, fades, filters, changes pitch and adjusts gain to create game cues. The creators do not endorse Murgik.

Additional CC0 audio by **Vehicle (Jan Schupke)**, **rubberduck**, **Ogrebane**, **Zane Little Music** and **Samza**. These are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Verification

Downloaded directly from author-uploaded OpenGameArt submissions on 2026-10-31. Each source page declares its license. The Tinysized ZIP also contains a CC0 readme, copied verbatim to public/audio/licenses/. All deployed samples were verified as RIFF/WAVE, Ogg/Vorbis or MP3 binary data (not HTML error responses). SHA-256 hashes, original names, byte sizes, source URLs, and measured PCM/Vorbis durations are in public/audio/manifest.json.

17 local samples; 4.46 MiB total audio. Samples are original author-produced assets, with no oscillator synthesis in this asset preparation. Source audio is unmodified and renamed; game playback layers and fades clips without blocking gameplay. All 17 assets decoded successfully in real browser Web Audio. Decoded MP3 durations are 6.165 seconds for victory and 14.655 seconds for defeat; the game uses short 3.7/3.3-second envelopes.

## Asset mapping

| Local file | Original file | Creator | License | Source |
|---|---|---|---|---|
| card-draw.ogg | paper_01.ogg | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) |
| card-slide.ogg | paper_02.ogg | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) |
| whoosh-swift.wav | tube-plastic-whoosh-01.wav | Vehicle (Jan Schupke) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Fantasy Sound Effects (Tinysized SFX)](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx) |
| whoosh-soft.wav | tube-plastic-whoosh-02.wav | Vehicle (Jan Schupke) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Fantasy Sound Effects (Tinysized SFX)](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx) |
| impact-body.ogg | hit_01.ogg | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) |
| impact-sword.wav | sword-clash-03.wav | Vehicle (Jan Schupke) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Fantasy Sound Effects (Tinysized SFX)](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx) |
| ui-hover.wav | scissors-close-01.wav | Vehicle (Jan Schupke) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Fantasy Sound Effects (Tinysized SFX)](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx) |
| ui-select.ogg | switch_01.ogg | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) |
| reveal-bell.ogg | bell_03.ogg | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) |
| magic-fire.wav | Fire impact 1.wav | ViRiX Dreamcore (David Mckee) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Magic SFX Sample](https://opengameart.org/content/magic-sfx-sample) |
| magic-heal.wav | Healing Full.wav | ViRiX Dreamcore (David Mckee) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Magic SFX Sample](https://opengameart.org/content/magic-sfx-sample) |
| magic-ice.wav | Ice attack 2.wav | ViRiX Dreamcore (David Mckee) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Magic SFX Sample](https://opengameart.org/content/magic-sfx-sample) |
| magic-wind.wav | Wind effects 5.wav | ViRiX Dreamcore (David Mckee) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Magic SFX Sample](https://opengameart.org/content/magic-sfx-sample) |
| magic-shimmer.wav | Misc 02.wav | ViRiX Dreamcore (David Mckee) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Magic SFX Sample](https://opengameart.org/content/magic-sfx-sample) |
| death-dissolve.wav | ghost.wav | Ogrebane | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Ghost](https://opengameart.org/content/ghost) |
| victory.mp3 | sboe.mp3 | Zane Little Music | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Hyper Ultra Fanfare](https://opengameart.org/content/hyper-ultra-fanfare) |
| defeat.mp3 | Game over.mp3 | Samza | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Game Over](https://opengameart.org/content/game-over-2) |

## Source selection

Organic paper, swishes, sword impacts and quiet foley are used for tactile card/UI actions. Designed magic spells provide wind, ice, fire, healing energy and shimmer layers. Forge combines reversed wind and healing buildup with a separate shimmer/bell/fire reveal. Death fades ghost and ice clips; victory/defeat use short envelopes of the dedicated signatures. The central sample mixer limits playback to eight simultaneous layers, trims silence, normalizes sample gain and applies fades, compression and a soft limiter. Hover is quiet, throttled and suppressed during dense action. There is no oscillator fallback.

## Runtime verification

All 14 cue types and an eight-layer stress mix were rendered through the actual mixer using browser OfflineAudioContext. At full master/effects volume the stress mix reached 0.80 sample peak (below full scale); individual cues peaked between 0.03 and 0.73. Browser tests also verified no playback/context before interaction, persisted master/effects/mute settings, mute suppression and zero external audio requests. Unit tests verify source hashes, declared licenses, normalization, voice limits, cancellation, failure handling and preservation of the lethal attack under its delayed victory signature.

Kenney official pages also confirmed CC0, but their current signed download endpoint returned HTTP 403 in this environment. No invalid HTML downloads or unavailable Kenney audio is shipped. The GPL/CC BY-SA Spell 4 sample inspected during research is excluded.

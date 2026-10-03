# Loomin — Audio-Visual Synesthesizer

A browser-based music sequencer and visualizer built with **Angular** + **Tailwind CSS**, running entirely on **Web Audio API** and **HTML5 Canvas**. Deployed via Vercel. Zero server.

## Session Summary (2026-06-09)

### Done
- Rewrote AI.md and loomin-composer-guide.md with complete instrument catalogue (15 presets, 11 sample sets, 5 synth types, 10 drum names).
- Deleted ~4.1 GB of orphan files from workspace.
- Pushed 250+ sample files to `github.com/samirsalmi/samples.git`, served via jsDelivr CDN.
- Updated `sample-manifests.ts` basePaths to CDN URLs.
- Cache API persistence: `caches.open('loomin-samples-v1')` stores decoded buffers across reloads.
- Preload-before-playback: `play()` awaits `_preloadActiveSampleSets()` before starting transport; `isPreloading` signal shown in UI.
- Grid pagination: `gridOffset`/`pageSize=50` (app.ts), `◀ ▶` nav buttons, `visibleStart()`/`visibleEnd()`.
- Fixed note labels scrolling off-screen — moved `overflow-x-auto` to step columns wrapper, added `flex-shrink-0` to label column.
- Fixed scroll buttons going negative — early return when at bounds.
- Fixed step numbers scrolling away — restructured grid into 2D frozen-pane layout: `overflow-auto` outer wrapper, sticky-left note labels column, sticky-top step numbers row.

---

## Architecture

| Layer | File | Role |
|-------|------|------|
| **Clock** | `audio.service.ts` | Master loop — iterates grid steps, dispatches note events, manages BPM/swing/transport |
| **Synth** | `instruments/poly-synth`, `bass-synth`, `distortion-synth` | Waveform generation, ADSR, filter sweeps, waveshapers |
| **Theory** | `utils/music-theory.ts` | Note parsing (sharps/flats), scales, diatonic chords — single source of truth |
| **Samples** | `sample-engine.service.ts` | Fetch → Cache API → decode → AudioBufferSourceNode playback. Scheduling is synchronous: nearest decoded sample is re-pitched; if none, the caller falls back to synth |
| **Mixer** | `master-mixer.service.ts` | Per-track faders, LPF filters, delay send, reverb send, LFO modulation |
| **Drums** | `drum-engine.service.ts` | Synthesized + sampled drum hits (Kick, Snare, Hi-Hat, Toms, Ride, Crash, Clap) |
| **Data** | `data/playlist-presets.ts` | Built-in song presets (SequencePreset[] array) |
| **Data** | `data/sample-manifests.ts` | Sample set definitions (SAMPLE_SETS, drum file map) |

---

## Instrument Presets (15 total)

Defined in `INSTRUMENT_PRESETS` inside `playlist-presets.ts`. Each preset overrides `synthType` and applies ADSR, filter envelope, vibrato, distortion, and/or a default sample set.

### Keyboard / Piano

- **🎹 Piano** (`piano`) — sampleSet: `acoustic-piano`. Triangle osc, 2ms attack, 2.2s decay to silence. Filter sweep 9000→2800Hz over 70ms for hammer knock.
- **🎹 Upright Piano** (`uprightPiano`) — sampleSet: `vsco-upright`. Brighter, shorter decay (2s). C2–G8 range.

### Guitar Family

- **🎸 Electric Guitar** (`guitar`) — sampleSet: `electric-guitar`. Sawtooth osc, 3ms attack, amp-sustains at 0.35 (amplifier hold). Filter 8500→2200Hz.
- **🎸 Emily Guitar (Warm)** (`karoryferGuitar`) — sampleSet: `karoryfer-guitar`. d'Addario Chromes flatwound. Warmer EQ curve, Bb2–C6.
- **🎸 BJAM Bridge (Aggressive)** (`bjamGuitar`) — sampleSet: `bjam-guitar`. Bridge pickup. Higher initial cutoff (10kHz), more resonance (Q=2). E3–E5.
- **🤘 Metal Guitar (Distortion)** (`metalGuitar`) — sampleSet: `bjam-guitar`. Dual sawtooth + asymmetric waveshaper (70% sat, 4x oversample). Filter 12000→3000Hz, Q=2.5. Palm-mute envelope.
- **🎸 Acoustic Guitar (Steel)** (`acousticGuitar`) — synth only. Sawtooth, 2ms attack, 2.4s decay. Filter 5500→1100Hz, Q=2.2.
- **🏛️ Classical Guitar (Nylon)** (`classicalGuitar`) — synth only. Triangle osc, 4ms attack, 3.5s decay. Filter 4000→750Hz, Q=1.3.

### Winds

- **🎵 Flute** (`flute`) — synth only. Triangle osc, 120ms breath attack, sustain 0.9. Vibrato 5.5Hz ±3.2Hz depth.
- **🎵 Flute (Orchestral)** (`orchestralFlute`) — sampleSet: `vsco-flute`. Triangle osc. C4–C7 range.

### Brass

- **🎺 Trumpet** (`trumpet`) — sampleSet: `vsco-trumpet`. Sawtooth osc, 30ms attack, sustain 0.8. Vibrato 6Hz ±2Hz.
- **📯 French Horn** (`frenchHorn`) — sampleSet: `vsco-horn`. Sawtooth osc, 50ms attack, sustain 0.85. A0–F5 range.

### Strings

- **🎻 Violin Section** (`violin`) — sampleSet: `vsco-violin`. Sawtooth osc, 60ms attack, sustain 0.8. Vibrato 5.5Hz ±3Hz. G3–D6.
- **🎻 Cello Section** (`cello`) — sampleSet: `vsco-cello`. Sawtooth osc, 40ms attack, sustain 0.8. Vibrato 5Hz ±2.5Hz. C2–F5.

### Percussion

- **🥁 Drums** (`drums`) — routed to DrumEngine when rowNotes contain drum names. Hybrid synth + MP3 samples.

---

## Sample Sets (11 total)

See `docs/sample-library.md` for which files exist, pitch corrections (VSCO files are named an octave low) and known broken sets (guitar/bass are Git LFS pointers).

Defined in `SAMPLE_SETS` inside `sample-manifests.ts`. Used when `playbackMode` is `"sample"` or `"layer"`.

| Key | Source | Notes | Range |
|-----|--------|-------|-------|
| `acoustic-piano` | Splendid Grand Piano (Steinway D) | 88 FLAC files, FF layer | A0–C8 |
| `electric-guitar` | cluesurf/wave (Public Domain) | String-per-file WAVs | D2–C6 |
| `electric-bass` | cluesurf/wave (Public Domain) | String-per-file WAVs | E1–G3 |
| `vsco-violin` | VSCO 2 CE (CC0) | Sustain vibrato FLACs | G3–D6 |
| `vsco-cello` | VSCO 2 CE (CC0) | Sustain FLACs | C2–F5 |
| `vsco-flute` | VSCO 2 CE (CC0) | Sustain FLACs | C4–C7 |
| `vsco-trumpet` | VSCO 2 CE (CC0) | Sustain FLACs | F3–D6 |
| `vsco-horn` | VSCO 2 CE (CC0) | Sustain FLACs | A0–F5 |
| `vsco-upright` | VSCO 2 CE (CC0) | Upright piano FLACs | C2–G8 |
| `karoryfer-guitar` | Karoryfer Emily Guitar | Warm flatwound FLACs | Bb2–C6 |
| `bjam-guitar` | VSCO 2 CE + BJAM | Bridge pickup sustain + chug FLACs | E3–E5 |

### Drum Samples (teropa/drumkit, MP3)

| Name | File | Sound |
|------|------|-------|
| Kick | `kick.mp3` | Deep thud |
| Snare | `snare.mp3` | Sharp crack |
| Hi-Hat | `hat-closed.mp3` | Tight chick |
| Open Hi-Hat | `hat-open.mp3` | Sizzling wash |
| Tom Low | `tom-low.mp3` | Low floor tom |
| Tom Mid | `tom-mid.mp3` | Mid rack tom |
| Tom High | `tom-high.mp3` | High rack tom |
| Ride | `ride.mp3` | Shimmering bell |
| Crash | `crash.mp3` | Explosive accent |

---

## Synth Types (Raw Oscillators)

Used when no instrument preset is selected, or when `playbackMode` is `"synth"`.

| Type | Waveform | Character |
|------|----------|-----------|
| `sine` | Pure sine | Warm, soft, fundamental-only — sub-bass, pads |
| `triangle` | Triangle | Bell-like, clean, mellow — arps, piano, flute |
| `square` | Square + sub + saturation | Gritty, buzzy, percussive — 8-bit, punchy bass |
| `sawtooth` | Sawtooth | Bright, rich, aggressive — lead, brass, guitar |
| `distortion` | Dual sawtooth + waveshaper | High-gain metal — chugs, crunch, leads |

The **distortion** engine adds: asymmetric tube waveshaper (distortion 0–1, drive 0–1), envelope-tracking lowpass cabinet filter (cutoff 200–20kHz, Q 0.1–10), dual-oscillator detune (0–50 cents), configurable ADSR (attack 0.001–0.5s), and hard noise gate (1ms open, 3ms close).

---

## Playback Modes

| Mode | Behavior |
|------|----------|
| `synth` | Pure subtractive synthesis. `sampleSet` ignored. |
| `sample` | Real `.wav`/`.flac` files from sample set. Falls back to synth per note when no set, no loaded sample, or a broken file. |
| `layer` | Synth + sample play simultaneously. `sampleBlend` (0–1) controls mix. |

**Retro Mode** (global toggle) forces all tracks to `synth`, bypassing all sample loading.

---

## Preset Format (JSON)

Presets live in `playlist-presets.ts` as objects conforming to `SequencePreset`:

- `name`, `artist`, `bpm`, `scale`, `rootNote` — song identity
- `stepCount` — grid length (8–216+)
- `timeSignature`, `stepResolution` — 4/4, 3/4, 6/8, 2/4, 5/4; 16th or 8th
- `swingPercentage` — 0–75 shuffle amount
- `tracks[]` — array of `Track` objects with `trackName`, `synthType`, `rowNotes`, `grid[ ][ ]`

Each track can set `instrumentPreset` (key into INSTRUMENT_PRESETS), `playbackMode`, `sampleSet`, distortion parameters, `delaySend`, `reverbSend`, `portamento`, and `arpEnabled`/`arpPattern`.

Drums are triggered by including any of: `Kick`, `Snare`, `Hi-Hat`, `Open Hi-Hat`, `Tom Low`, `Tom Mid`, `Tom High`, `Ride`, `Crash`, `Clap` in `rowNotes`.

Grid values: `0` = off, `0.6` = normal velocity, `1` = accent.

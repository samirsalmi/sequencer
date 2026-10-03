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
| **Mixer** | `master-mixer.service.ts` | Per-track fader → filter → pan, post-pan delay/reverb sends, damped stereo reverb, tape-style delay, glue compressor + limiter |
| **Drums** | `drum-engine.service.ts` | Synthesized + sampled drum hits (Kick, Snare, Hi-Hat, Toms, Ride, Crash, Clap) |
| **Data** | `data/playlist-presets.ts` | Built-in song presets (SequencePreset[] array) |
| **Data** | `data/sample-manifests.ts` | Sample set definitions (SAMPLE_SETS, drum file map) |

---

## Instrument Presets (15)

Defined in `INSTRUMENT_PRESETS` in `playlist-presets.ts`. Every melodic instrument has two voices:
**realistic** = its `sampleSet` (sample / layer mode) and **retro** = its synth patch (synth mode, RETRO toggle,
and automatic fallback when a sample is missing).

| Key | Realistic (sample set) | Retro voice |
|-----|------------------------|-------------|
| `piano` | `acoustic-piano` | triangle + octave sine, hammer filter sweep, key-tracked |
| `uprightPiano` | `vsco-upright` | triangle + detuned octave square (honky) |
| `guitar` | `electric-guitar` (broken: Git LFS) | Karplus–Strong pluck, bright |
| `classicalGuitar` | `karoryfer-guitar` (closest available) | KS pluck, soft nylon |
| `acousticGuitar` | `karoryfer-guitar` (closest available) | KS pluck, steel |
| `karoryferGuitar` | `karoryfer-guitar` | KS pluck, warm |
| `bjamGuitar` | `bjam-guitar` | KS pluck, very bright |
| `metalGuitar` | `bjam-guitar` + drive | double-tracked saws → distortion |
| `bass` | `electric-bass` (broken: Git LFS) | KS pluck, round |
| `violin` / `cello` | `vsco-violin` / `vsco-cello` | detuned saw section, bow noise, delayed vibrato |
| `orchestralFlute` | `vsco-flute` | sine + triangle, breath noise, vibrato |
| `trumpet` / `frenchHorn` | `vsco-trumpet` / `vsco-horn` | saw with opening filter "blat" / mellow covered tone |
| `drums` | teropa drum samples | synth kit (all 10 drum names, incl. toms / ride / crash) |

Patch fields: `engine` ('subtractive' | 'pluck'), `pluck {brightness, decay}`, `oscType`, `osc2Type/osc2Octave/osc2Level/detune`,
`noise` (breath/bow), `keyTracking`, `filterEnvelope`, `ampAttack/Decay/Sustain/Release`, `velocitySensitivity`
(volume **and** brightness), `vibrato {depth (cents), rate, delay}`, `distortion`, `highPassFilter`.

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

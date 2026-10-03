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
**realistic** = its `sampleSet` (real recordings in `public/samples/`, used in sample / layer mode) and
**retro** = its synth patch, built **only from the four basic waves** (sine / square / triangle / sawtooth), used in
synth mode, the RETRO toggle, and as automatic fallback when a sample is missing.

| Key | Realistic (sample set) | Retro waves |
|-----|------------------------|-------------|
| `piano` | `acoustic-piano` (Splendid Grand) | square + triangle, decaying |
| `uprightPiano` | `upright-piano` | two detuned squares (honky-tonk) |
| `guitar` | `electric-guitar` (Karoryfer) | square + saw, pluck pitch-drop |
| `classicalGuitar` | `nylon-guitar` | triangle + soft square |
| `acousticGuitar` | `acoustic-guitar` (Iowa) | saw + triangle |
| `karoryferGuitar` | `emily-guitar` | saw + triangle, warm |
| `bjamGuitar` | `bjam-guitar` | saw + square, bright |
| `metalGuitar` | `bjam-guitar` + drive | double-tracked saws → distortion |
| `bass` | `electric-bass` (Karoryfer) | triangle + square |
| `violin` | `violin` (VSCO 2) | detuned saws, delayed vibrato |
| `cello` | `cello` (chromatic, Freesound) | saw + triangle, delayed vibrato |
| `orchestralFlute` | `flute` (VSCO 2) | triangle + octave sine, vibrato |
| `trumpet` / `frenchHorn` | `trumpet` / `french-horn` (VSCO 2) | saw + square swell / triangle + saw, mellow |
| `drums` | `drums` (all 10 names, incl. clap) | synth kit |

Patch fields: `oscType`, `osc2Type/osc2Octave/osc2Level/detune`, `level` (retro/sample balance), `keyTracking`,
`filterEnvelope`, `ampAttack/Decay/Sustain/Release`, `velocitySensitivity` (volume **and** brightness),
`pitchDrop {semitones, time}`, `vibrato {depth (cents), rate, delay}`, `distortion`, `highPassFilter`.

---

## Sample Sets (13 + drums)

Served from `public/samples/<set>/<Note>.flac` (sharps written `s`, e.g. `Cs4.flac`). Built by
`scripts/build-samples.py` (leading silence trimmed, mono FLAC, pitch-checked). Note lists live in
`sample-manifests.ts`; old set names (`vsco-*`, `karoryfer-guitar`) still resolve via `SAMPLE_SET_ALIASES`.
Full source / license table: `public/samples/CREDITS.md`. Audit notes: `docs/sample-library.md`.

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

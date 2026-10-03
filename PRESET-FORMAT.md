# Loomin Preset Format Reference

A preset is a plain JSON object saved in `src/app/data/playlist-presets.ts` inside the `PLAYLIST_PRESETS` array. Every built-in song in the playlist is a preset.

## TypeScript Interface

```typescript
interface SequencePreset {
  name: string;
  artist: string;
  bpm: number;
  scale: string;
  rootNote: string;
  stepCount?: number;          // default: auto-detect from grid width
  swingPercentage?: number;    // default: 0
  timeSignature?: string;      // default: "4/4"
  stepResolution?: '16th' | '8th';  // default: "16th"
  tracks: Track[];
}

interface Track {
  trackName: string;
  synthType: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'distortion';
  rowNotes: string[];
  grid: number[][];

  // Optional
  ties?: boolean[][];         // default: all false (no sustains)
  delaySend?: number;         // 0.0 – 1.0, default: 0
  reverbSend?: number;        // 0.0 – 1.0, default: 0
  arpEnabled?: boolean;       // default: false (ignored on load — toggle in UI)
  arpPattern?: 'up' | 'down' | 'invert' | 'random';  // default: 'up'
  portamento?: number;        // glide time in ms, default: 0
  instrumentPreset?: string;  // key into INSTRUMENT_PRESETS (see below), default: undefined

  // Sample playback
  playbackMode?: 'synth' | 'sample' | 'layer';  // default: 'synth'
  sampleSet?: string;         // key into SAMPLE_SETS (see below), default: undefined
  sampleBlend?: number;       // 0–1, blend ratio when playbackMode is 'layer', default: 0.5

  // Distortion Guitar engine (synthType: "distortion")
  distortion?: number;        // 0–1, waveshaper saturation amount
  drive?: number;             // 0–1, virtual preamp drive
  filterCutoff?: number;      // Hz, lowpass cabinet simulation
  filterResonance?: number;   // Q factor of the lowpass filter
  detune?: number;            // cents, dual-oscillator detune width
  envelope?: {                // ADSR shaping
    attack: number;           // seconds
    decay: number;            // seconds
    sustain: number;          // 0–1 level
    release: number;          // seconds
  };
}
```

---

## Top-Level Properties

### `name` (string, required)
Display name of the song.
```
"name": "Für Elise (36-step)"
```

### `artist` (string, required)
Artist credit.
```
"artist": "Ludwig van Beethoven"
```

### `bpm` (number, required)
Tempo in beats per minute. The sequencer step duration is `30 / bpm` seconds. A step is one time-slice of the grid — common resolutions are one 16th note, one 8th note, or one triplet depending on how many steps you allocate per measure.

Recommended range: `40` – `300`. Common values:
| BPM | Feel |
|-----|------|
| 80  | Slow ballad |
| 100 | Moderate pop |
| 120 | Upbeat dance |
| 160 | Fast metal |

```
"bpm": 120
```

### `scale` (string, required)
Musical scale used for the chord helper and note generation in the UI. Not used for actual playback — row notes are played as written.

| Value | Intervals |
|-------|-----------|
| `"major"` | I ii iii IV V vi vii° |
| `"naturalMinor"` | i ii° III iv v VI VII |
| `"dorian"` | i ii III IV v vi° VII |
| `"pentatonic"` | I ii iii V vi |

```
"scale": "major"
```

### `rootNote` (string, required)
Tonic key of the song. One of: `C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B`. Used by the scale/chord helper UI, not by playback.

```
"rootNote": "A"
```

### `stepCount` (number, optional)

Number of steps per loop. What one step represents depends on `stepResolution` (default: 16th note). If omitted, auto-detected from the first row of the first track's grid. Can be set to any positive integer (min 1, no max).

```
"stepCount": 36
```

When `timeSignature` is set, the header shows the measure count computed from `stepCount / stepsPerMeasure(timeSig, resolution)`. If the step count doesn't evenly divide, the label turns amber as a visual warning.

Examples of how `stepCount` maps to time signatures at different note resolutions:

| stepCount | Resolution | Time Signature | Measures |
|-----------|------------|----------------|----------|
| 54        | 8th note   | 3/4            | 9 (6 steps/bar) |
| 36        | 16th note  | 3/8            | 6 (6 steps/bar) |
| 16        | 16th note  | 4/4            | 1 (16 steps/bar) |
| 12        | 16th note  | 3/4            | 1 (12 steps/bar) |
| 12        | 16th note  | 6/8            | 1 (12 steps/bar) |
| 8         | 16th note  | 2/4            | 1 (8 steps/bar) |
| 25        | 16th note  | 4/4            | ~1.6 (irregular phrase) |

### `swingPercentage` (number, optional)

Shuffle/groove amount. Even-numbered steps are delayed by `swingPercentage × stepDuration × 0.5`. Range: `0` – `75`. Default: `0` (straight).

```
"swingPercentage": 20    // audible shuffle
```

At 20 %, every offbeat 16th is delayed by ~10 % of the step duration, giving a swung/loping feel.

### `timeSignature` (string, optional)

Musical meter of the song. Format: `"numerator/denominator"`. Determines how the grid draws beat and measure separator lines. Default: `"4/4"`.

| Value | Beats per measure | Beat unit | Grid lines |
|-------|-------------------|-----------|------------|
| `"4/4"` | 4 | quarter note | Measure every 16 steps, beat every 4 steps (16th resolution) |
| `"3/4"` | 3 | quarter note | Measure every 12 steps, beat every 4 steps |
| `"6/8"` | 2 (compound) | dotted quarter | Measure every 12 steps, compound beat every 6 steps |
| `"2/4"` | 2 | quarter note | Measure every 8 steps, beat every 4 steps |
| `"5/4"` | 5 | quarter note | Measure every 20 steps, beat every 4 steps |

When `stepResolution` is `"8th"`, step counts are halved (e.g., 4/4 with 8th resolution = 8 steps per measure, beat every 2 steps).

```
"timeSignature": "3/4"
```

### `stepResolution` (string, optional)

What one grid step represents musically. Default: `"16th"`.

- `"16th"` — Each step = one 16th note (standard). Gives 16 steps per measure in 4/4.
- `"8th"` — Each step = one 8th note. Gives 8 steps per measure in 4/4. Useful for compound meters like 6/8 where 8th-note resolution aligns with the rhythmic grid.

The engine calculates `stepsPerMeasure = numerator × (resolutionBase / denominator)` where `resolutionBase` is 16 for 16th notes or 8 for 8th notes.

```
"stepResolution": "16th"
```

> **Step alignment validation**: When a preset is loaded or step count is changed in the UI, the engine checks if `stepCount` is a multiple of `stepsPerMeasure`. If not, a warning is logged to the console. The measures annotation in the header turns amber to indicate the misalignment.

---

## Track Properties

### `trackName` (string, required)

Display name shown in the mixer and grid header.

```
"trackName": "🎵 Right Hand — Melody"
```

### `synthType` (string, required)

The waveform used for every note in this track.

| Value | Instrument Engine | Character |
|-------|-------------------|-----------|
| `"sine"` | PolySynth (pure sine) | Warm, soft, fundamental-only — good for bass or pad |
| `"square"` | BassSynth (square + sub + saturation) | Gritty, buzzy, percussive — good for bass or attack |
| `"sawtooth"` | PolySynth (sawtooth) | Bright, rich, buzzy — good for lead melody |
| `"triangle"` | PolySynth (triangle) | Bell-like, clean, mellow — good for arp or piano |
| `"distortion"` | DistortionSynth (sawtooth + waveshaper) | High-gain metal guitar — asymmetric tube distortion, envelope-tracking filter, noise gate. Configurable via `distortion`, `drive`, `filterCutoff`, `filterResonance`, `detune`, and `envelope` fields. |

```
"synthType": "triangle"
```

**Drum routing**: If any `rowNotes` entry matches a drum name (`Kick`, `Snare`, `Hi-Hat`, `Open Hi-Hat`, `Tom Low`, `Tom Mid`, `Tom High`, `Ride`, `Crash`, `Clap`), the track is routed to the DrumEngine instead. The `synthType` is ignored for drum rows. When Retro Mode is OFF and sample files exist for a drum name, real MP3 samples are played instead of synthesized drum sounds.

**Instrument override**: If `instrumentPreset` is set on the track, `synthType` is also ignored — the preset's oscillator type and envelope parameters take precedence.

**Sample override**: If `playbackMode` is `"sample"` or `"layer"` and a matching `sampleSet` is found, the track plays real recorded `.wav` samples instead of synthesized notes. In `"layer"` mode, both the synth and sample play simultaneously, blended by the `sampleBlend` ratio (0 = full synth, 1 = full sample).

### `rowNotes` (string[], required)

One label per row of the grid. Each label is either a **piano note** or a **drum name**.

**Piano notes** follow the standard scientific pitch notation:
```
[A-G][#]?[0-8]
```
Examples: `C4` (middle C), `A#2`, `E5`, `F#3`, `C8`, `A0`

The note-to-MIDI formula: `(octave + 1) × 12 + semitoneIndex` where semitone index is `C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11`.

Valid octave range: `0` (lowest) to `8` (highest). Available notes span `A0` (MIDI 21) through `C8` (MIDI 108).

**Drum names** — these strings bypass the synth and trigger the DrumEngine:

| Name | Sound (Synthesized) |
|------|---------------------|
| `"Kick"` | Deep sine sweep + sub-punch + transient click |
| `"Snare"` | Pitched oscillators + highpassed noise with peak EQ |
| `"Hi-Hat"` | 6 detuned square oscillators, highpassed at 7 kHz |
| `"Open Hi-Hat"` | Same as Hi-Hat but longer decay (0.32 s) |
| `"Tom Low"` | Tuned sine + triangle oscillator at ~80 Hz |
| `"Tom Mid"` | Tuned sine + triangle oscillator at ~120 Hz |
| `"Tom High"` | Tuned sine + triangle oscillator at ~180 Hz |
| `"Ride"` | Bandpassed noise + high-frequency sine, long decay (0.4 s) |
| `"Crash"` | Wideband noise + high sine sweep, long decay (0.6 s) |
| `"Clap"` | 3 layered noise bursts, bandpassed at 1.8 kHz |

> **Sample drums**: When Retro Mode is OFF, all 10 drum names automatically play real MP3 samples (from `/samples/drums/`) instead of synthesized sounds.

```
"rowNotes": ["Kick", "Snare", "Hi-Hat", "Open Hi-Hat", "Ride", "Crash"]
```

A track can mix drum and synth rows, but this is not recommended — the engine treats the entire track as a drum track if ANY row matches a drum name.

### `grid` (number[][], required)

The step pattern matrix. A 2D array with one row per entry in `rowNotes`, and one column per step.

```
grid[row][step] = velocity value
```

| Value | State | Display |
|-------|-------|---------|
| `0` | Off | Empty cell |
| `0.6` | Normal velocity | Dimly lit cell |
| `1` | Accent velocity | Brightly lit cell |

The three-state cycle is `0 → 0.6 → 1.0 → 0`. Only these three values are valid.

**Example** — 4 rows × 16 steps:

```json
"rowNotes": ["Kick", "Snare", "Hi-Hat", "Clap"],
"grid": [
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0.6, 0, 0.6, 0, 0.6, 0, 0.6, 0, 0.6, 0, 0.6, 0, 0.6, 0, 0.6, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
]
```

**Constraints:** Every row must have the same number of columns (or at least `stepCount` columns — extras are truncated, shortages are zero-padded).

### `ties` (boolean[][], optional)

Sustain matrix, parallel to `grid`. `ties[row][step] = true` means the note that *started* on the previous step is sustained through *this* step instead of being re-triggered.

**How note duration works** (for synth rows, not drums):
1. Note fires at the step where `grid[row][step] > 0`
2. Engine looks ahead for consecutive `true` entries in the ties matrix starting from the *next* step
3. Total duration = `(1 + tieCount) × stepDuration` seconds

**Example** — 8th note followed by a 16th rest:

```json
"rowNotes": ["C4"],
"grid": [
  [1, 0, 0]
],
"ties": [
  [false, true, false]
]
```
C4 fires at step 0, `ties[1] = true` → tieCount = 1 → duration = 2 steps = 1 eighth note. Step 2 is silent.

**Example** — dotted 8th (3 sixteenths):

```json
"rowNotes": ["A4"],
"grid": [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]
],
"ties": [
  [f, f, f, f, f, f, f, f, f, f, t, t]
]
```
A4 fires at step 9, `ties[10,11] = true` → tieCount = 2 → duration = 3 steps = dotted 8th.

> The constants `f = false` and `t = true` are defined at the top of `playlist-presets.ts` and are used throughout built-in presets for readability.

If omitted entirely, all ties default to `false` (every note is a staccato 16th).

---

### `delaySend` (number, optional)

Amount of signal sent to the stereo ping-pong delay bus. Range: `0.0` – `1.0`. Default: `0`.

```
"delaySend": 0.35
```

The delay time and feedback are global settings controlled by the UI sliders (not per-track).

### `reverbSend` (number, optional)

Amount of signal sent to the convolution reverb. Range: `0.0` – `1.0`. Default: `0`.

```
"reverbSend": 0.75
```

The reverb mix (wet/dry of the FX return) is a global UI slider, not per-track. The reverb is a synthetic impulse response ~2 seconds long with exponential decay.

Setting both `delaySend` and `reverbSend` on the same track creates spatial depth (delay echoes + wash).

### `arpEnabled` (boolean, optional)

Enables the per-track arpeggiator. Default: `false`.

> **Note:** When loading a preset from `playlist-presets.ts`, the engine resets `arpEnabled` to `false` for all tracks. The property in the JSON file documents the *intended* state — the user must toggle the Arp button in the UI to activate it after loading.

```
"arpEnabled": true
```

When active and multiple rows have a non-zero cell at the same step, instead of playing all notes simultaneously, the engine sub-divides the step into equal micro-steps and plays the notes one at a time in the pattern order.

### `arpPattern` (string, optional)

Direction of arpeggiation when `arpEnabled` is active. Default: `'up'`.

| Value | Behavior |
|-------|----------|
| `"up"` | Low to high frequency |
| `"down"` | High to low frequency |
| `"invert"` | Alternating low → high → low → high (interleaving) |
| `"random"` | Shuffled randomly each step |

```
"arpPattern": "updown"
```

> **Note:** The TypeScript interface also accepts `"updown"` which currently behaves identically to `"up"`.

### `portamento` (number, optional)

Glide time in milliseconds. When set to a positive value, the synth engine slides the pitch from the previously played note to the current note over this duration. Default: `0` (no glide).

```
"portamento": 12
```

Works on BassSynth (square), PolySynth (sine/saw/triangle), and DistortionSynth (`"distortion"`). Only applies within the same track. The glide starts from whatever note was last triggered on that track.

---

## Distortion Engine Parameters (`synthType: "distortion"`)

When `synthType` is set to `"distortion"`, the track is routed through the **DistortionSynth** — a dual-oscillator high-gain guitar engine. The following fields configure its tone:

### `distortion` (number, optional)

Saturation amount for the asymmetric waveshaper. Range: `0.0` – `1.0`. Default: `0.7`.

Controls how hard the signal is clipped by the waveshaper. The curve is asymmetric — positive half compresses softly (tube-like), negative half clips harder — producing even-order harmonics for that "crunch" character.

```
"distortion": 0.90    // aggressive metal saturation
```

### `drive` (number, optional)

Virtual preamp gain fed into the waveshaper. Range: `0.0` – `1.0`. Default: `0.6`.

Internally mapped as `1 + drive × 0.5`, so higher values push more signal level into the saturation stage.

```
"drive": 0.85          // heavy preamp clipping
```

### `filterCutoff` (number, optional)

Lowpass filter cutoff frequency in Hz, simulating a 4×12 guitar cabinet. Default: `3500`.

The filter is **envelope-tracking**: at each note attack it briefly opens to `cutoff × 4` (up to 18 kHz) for a percussive bite, then settles to the configured cutoff over the decay phase. This mimics how a real amp's preamp compresses and rolls off highs on palm-muted chugs.

| Setting | Sound |
|---------|-------|
| 1500–2500 | Dark, scooped — death metal |
| 2500–3500 | Balanced thrash crunch |
| 3500–5000 | Bright, cutting — hard rock / lead |

```
"filterCutoff": 2800    // classic thrash cabinet voicing
```

### `filterResonance` (number, optional)

Q factor (resonance) of the lowpass filter. Default: `1`.

Higher values create a peak at the cutoff frequency, adding "honk" or mid-range presence. Keep low (`0.1`–`0.5`) for scooped metal; higher (`1`–`3`) for aggressive punk/hardcore bite.

```
"filterResonance": 0.15  // subtle — keeps low-end punchy without honk
```

### `detune` (number, optional)

Detune in cents (100 cents = 1 semitone) applied to the second oscillator. Default: `10`.

The engine runs two sawtooth oscillators in parallel. Detuning them slightly creates a thick, double-tracked feel similar to layered guitar takes.

| Detune | Effect |
|--------|--------|
| 0 | Single-oscillator, thin |
| 5–8 | Tight double-track, natural |
| 10–15 | Wide, lush — good for leads |
| 20+ | Unstable chorus / detune effect |

```
"detune": 7    // tight double-track for rhythm chugs
```

### `envelope` (object, optional)

ADSR envelope controlling the master gain of the distortion engine. All values in seconds (except `sustain` which is a 0–1 level).

| Field | Range | Default | Description |
|-------|-------|---------|-------------|
| `attack` | 0.001–0.5 | 0.01 | Time to reach full volume. Fast = percussive pick attack. |
| `decay` | 0.01–1.0 | 0.1 | Time to fall from peak to sustain level. |
| `sustain` | 0–1 | 0.3 | Level held after decay until note end. |
| `release` | 0.001–1.0 | 0.1 | Time to fade to silence after note end. |

For metal rhythm playing at high tempos (200+ BPM), use a fast attack (`0.002`), short decay (`0.12`), low sustain (`0.25`), and quick release (`0.05`) — this gives tight palm-muted chugs where each downpick is distinct.

```
"envelope": {
  "attack": 0.002,
  "decay": 0.12,
  "sustain": 0.25,
  "release": 0.05
}
```

### Noise Gate (built-in, not configurable)

The DistortionSynth includes a hard noise gate that opens in 1ms on attack and closes in 3ms at note end. This cleanly chops the space between fast palm-muted downpicks, preventing note bleed and keeping each chug distinct.

### `instrumentPreset` (string, optional)

Enables subtractive synthesis to shape the raw waveform into a recognizable instrument. When set, the `synthType` field is ignored — the preset overrides the oscillator type, amplitude envelope, filter behavior, and modulation.

Key into the `INSTRUMENT_PRESETS` constant defined in `playlist-presets.ts`:

| Key | Oscillator | Filter Envelope | Amp Envelope | Extra |
|-----|-----------|-----------------|-------------|-------|
| `"piano"` | triangle | 9000Hz → 2800Hz over 70ms, Q=0.7 | Attack: 2ms, Decay: 2.2s, Sustain: 0.0 | Velocity-sens: 0.9, sampleSet: `acoustic-piano` |
| `"flute"` | triangle | none | Attack: 120ms, Decay: 200ms, Sustain: 0.9, Release: 150ms | Vibrato: 5.5Hz, ±3.2Hz depth |
| `"guitar"` | sawtooth | 8500Hz → 2200Hz over 120ms, Q=1.5 | Attack: 3ms, Decay: 500ms, Sustain: 0.35 | sampleSet: `electric-guitar` |
| `"classicalGuitar"` | triangle | 4000Hz → 750Hz over 320ms, Q=1.3 | Attack: 4ms, Decay: 3.5s, Sustain: 0.0 | Nylon-string warmth |
| `"acousticGuitar"` | sawtooth | 5500Hz → 1100Hz over 280ms, Q=2.2 | Attack: 2ms, Decay: 2.4s, Sustain: 0.0 | Steel-string body resonance |
| `"drums"` | sine | none | Attack: 1ms, Decay: 300ms, Sustain: 0.0 | Triggers DrumEngine when row has drum names |

```
"instrumentPreset": "guitar"
```

**How filter envelopes work:** When a note triggers on a guitar track, two filter events happen simultaneously:
1. **Per-voice filter** inside PolySynth: starts at 8000Hz (bright attack), ramps to 600Hz (mellow ring-out) over 70ms.
2. **Track-level filter** in MasterMixer: the same sweep also fires on the track's dedicated low-pass filter node, which sits between the fader and the master bus.

This dual-filter approach is what creates the realistic "pluck → body" transient that human ears interpret as a guitar string being picked. Tracks without an instrument preset have their track-level filter fixed at 20kHz (transparent).

### Distortion & High-Pass Filter (Legacy)

> **Note:** The `heavyGuitar` preset was removed from the app. This section documents the engine's capabilities for reference if you add a similar preset in the future.

Certain presets include two additional signal processing stages:

**Distortion** — A `WaveShaperNode` with a `tanh`-based soft-clipping curve. The `amount` parameter (0–1) controls drive. At 0.7 (70%), it delivers the saturated crunch characteristic of 2000s high-gain metal rhythm tones. The signal chain is:

```
osc → lowpass filter (envelope) → highpass filter → waveshaper (distortion) → gain (amp envelope) → destination
```

```typescript
"distortion": {
  "amount": 0.7,        // 0.0–1.0 drive
  "oversample": "4x"    // optional, reduces aliasing
}
```

**High-Pass Filter** — A fixed `BiquadFilterNode` (highpass) inserted before the distortion stage. Cuts sub-80Hz frequencies to tighten palm-muted chugs and prevent mud build-up.

```typescript
"highPassFilter": {
  "frequency": 80        // Hz
}
```

Both are optional — presets that omit these fields skip the corresponding stage, keeping the signal path identical to the original architecture.

---

## Per-Track Filter Architecture

Every track now has its own dedicated `BiquadFilterNode` (low-pass) inserted between the fader and the master filter bus. This filter is set to 20kHz (fully open) by default, making it transparent for tracks without an instrument preset.

When an instrument preset with a `filterEnvelope` (e.g. guitar) is active, each note trigger fires an envelope sweep on this track filter alongside the per-voice filter in the synth engine. The track filter shapes the overall tone of the entire track, while the per-voice filter handles individual note articulation.

The master filter (in the FX bus) is unchanged — it still provides global tone shaping after all tracks sum together.

## Global FX Parameters (UI-controlled, not per-preset)

These are set via UI sliders and are not stored in the preset JSON, but affect overall mix:

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Delay Time | 0.05 – 1.0 s | 0.25 s | Stereo delay interval |
| Delay Feedback | 0 – 0.95 | 0.30 | Number of repeats (higher = more) |
| Reverb Mix | 0 – 1.0 | 0.30 | Wet/dry of the FX return bus |
| LFO Rate | 0.1 – 20 Hz | 3.0 Hz | Speed of filter modulation |
| LFO Depth | 0 – 2000 | 0 | How much the LFO sweeps the filter frequency |
| LFO Filter Freq | 200 – 20000 Hz | 20000 Hz | Base frequency of the LFO-modulated filter |

---

## Drum Engine Reference

The DrumEngine ignores `synthType` and produces its own sounds when `rowNotes` contain drum names. When Retro Mode is OFF and MP3 sample files exist for the drum name, real drum samples are played instead:

| Note Name | Synthesized Engine | Sample File |
|-----------|--------------------|-------------|
| `Kick` | Sine sweep 160→38 Hz + sub 60→30 Hz + noise click | `kick.mp3` |
| `Snare` | Triangle 230 Hz + sine 185 Hz + highpassed noise (1.2 kHz HP, 4.5 kHz peak) | `snare.mp3` |
| `Hi-Hat` | 6 detuned square oscillators (1.6–6.4 kHz), 55 ms decay | `hat-closed.mp3` |
| `Open Hi-Hat` | Same oscillators, 320 ms decay | `hat-open.mp3` |
| `Tom Low` | Tuned sine + triangle, ~80 Hz, 200 ms decay | `tom-low.mp3` |
| `Tom Mid` | Tuned sine + triangle, ~120 Hz, 200 ms decay | `tom-mid.mp3` |
| `Tom High` | Tuned sine + triangle, ~180 Hz, 200 ms decay | `tom-high.mp3` |
| `Ride` | Bandpassed noise + high sine (8 kHz), 400 ms decay | `ride.mp3` |
| `Crash` | Wideband noise + sine sweep, 600 ms decay | `crash.mp3` |
| `Clap` | 3 layered noise bursts (0, 8, 16 ms offset), 1.8 kHz bandpass *(no sample — clap is synth-only)* | — |

All drum sounds respond to velocity (`0.6` = quieter, `1.0` = full volume). Drums do not support ties.

### Sample Routing

When Retro Mode is OFF, the engine checks each drum name against `drumHasSample()`:
- If a sample file exists, the DrumEngine is bypassed and the MP3 is played directly via `Howl`.
- If no sample file exists (e.g., `Clap`), the synthesized DrumEngine sound is used as fallback.

Sample files live at `/samples/drums/` and are defined in `sample-manifests.ts`. The mapping from drum name to filename uses kebab-case (e.g., `Tom Low` → `tom-low.mp3`).

---

## Complete Preset Example

```typescript
{
  "name": "Für Elise (Sheet Music)",
  "artist": "Ludwig van Beethoven",
  "bpm": 120,
  "scale": "naturalMinor",
  "rootNote": "A",
  "stepCount": 60,
  "swingPercentage": 0,
  "timeSignature": "3/4",
  "stepResolution": "16th",
  "tracks": [
    {
      "trackName": "🎹 Right Hand — Melody",
      "synthType": "triangle",
      "instrumentPreset": "piano",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "reverbSend": 0.45,
      "delaySend": 0.1,
      "rowNotes": ["E5", "D#5", "D5", "C5", "B4", "A4", "G#4", "E4"],
      "grid": [
        [1,0,1,0,1,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 1,0,0,0,0,0, 1,0,0,0,0,0],
        [0,1,0,1,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0],
        [0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0],
        [0,0,0,0,0,0, 0,0,1,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,1,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,1,0,0, 0,1,0,0,0,0],
        [0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,1,1,0, 0,0,1,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,1,1,0, 0,0,1,0,0,0, 0,0,1,0,0,0],
        [0,0,0,0,0,0, 0,0,0,0,0,0, 1,1,0,0,0,0, 0,0,1,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 1,1,0,0,0,0, 0,0,1,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0],
        [0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0],
        [0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0]
      ]
    },
    {
      "trackName": "🎹 Left Hand — Accompaniment",
      "synthType": "triangle",
      "instrumentPreset": "piano",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "reverbSend": 0.35,
      "delaySend": 0.05,
      "rowNotes": ["A2", "E3", "A3", "E4", "G#3"],
      "grid": [
        [1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 1,0,0,0,0,0],
        [0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0],
        [0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 0,1,0,0,0,0],
        [0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,1,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0],
        [0,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 1,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0]
      ]
    }
  ]
}
```

---

## Sample Sets & Playback Modes

Tracks can play real recorded audio samples instead of synthesized waveforms. Sample sets are defined in `src/app/data/sample-manifests.ts`.

### Sample Set Configuration

```typescript
interface SampleSet {
  name: string;            // key used in sampleSet field
  label: string;           // display name
  basePath: string;        // URL prefix for loading .wav files
  noteRange: [number, number];  // [minMIDI, maxMIDI]
  defaultNote: string;     // fallback note name
  noteToFilename: (note: string) => string | null;  // mapping function
}
```

### Available Sample Sets

| Key | Label | Note Range | Source |
|-----|-------|------------|--------|
| `"acoustic-piano"` | Acoustic Piano | A0–C8 (MIDI 21–108) | 88 `.wav` files, one per key |
| `"electric-guitar"` | Electric Guitar | D2–C6 (MIDI 38–84) | Multi-sample guitar |
| `"electric-bass"` | Electric Bass | E1–G3 (MIDI 26–56) | Multi-sample bass |

### Drum Samples

In addition to note-based sample sets, drum names (`Kick`, `Snare`, `Hi-Hat`, etc.) have their own MP3 sample files in `/samples/drums/`. These are loaded automatically when Retro Mode is OFF. See the [Drum Engine Reference](#drum-engine-reference) table for the full mapping.

### Playback Mode Behavior

| Mode | Behavior |
|------|----------|
| `"synth"` | Pure subtractive synthesis via the waveform engine. `sampleSet` is ignored. |
| `"sample"` | Real `.wav` files from the sample set. Falls back to synth if no sample set is found. |
| `"layer"` | Both synth and sample play simultaneously. `sampleBlend` (0–1) controls the ratio: 0 = all synth, 1 = all sample. |

**Retro Mode** (global toggle in the UI) forces all tracks to `"synth"` mode, bypassing all sample loading and playback entirely.

### Note Resolution for Samples

When a track uses sample playback, the engine maps note names to sample files using `noteToFilename()`:

- **Piano**: `A0` → `a0.wav`, `C4` → `c4.wav`, `C#4` → `cs4.wav`, etc.
- **Guitar**: `D2` → `d2.wav`, `F#3` → `fs3.wav`, etc.
- **Bass**: `E1` → `e1.wav`, `G#2` → `gs2.wav`, etc.

If a note is outside the sample set's `noteRange`, the engine falls back to the `defaultNote` sample (e.g., `C4` for piano).

---

## Adding to the App

To add a new built-in preset, append an object to the `PLAYLIST_PRESETS` array in `src/app/data/playlist-presets.ts`:

```typescript
export const PLAYLIST_PRESETS: SequencePreset[] = [
  // ... existing presets ...

  {
    name: 'Your Song',
    artist: 'You',
    bpm: 120,
    scale: 'major',
    rootNote: 'C',
    stepCount: 16,
    timeSignature: '4/4',
    stepResolution: '16th',
    tracks: [ /* ... */ ],
  },
];
```

The app will automatically pick it up — no other changes needed. The name appears in the Playlist dropdown. The `SequencePreset` interface is at the top of the same file.

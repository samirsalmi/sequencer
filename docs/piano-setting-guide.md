# Piano Playback Guide: Synth, Sample & Layer Modes

## 1. Three Playback Modes

Every piano track has a `playbackMode` field that controls how notes are generated:

| Mode | Audio Source | Best For |
|------|-------------|----------|
| `"synth"` | Triangle-wave oscillator with piano ADSR + filter envelope | Fast iteration, low memory, consistent sound |
| `"sample"` | Real Steinway D FLAC files (62 velocity-mapped notes) | Authentic piano timbre, attack transient |
| `"layer"` | Synth + sample blended together (controlled by `sampleBlend`) | Warmth of synth sustain + realism of sample attack |

---

## 2. Synth Mode (`playbackMode: "synth"`)

Uses a pure triangle-wave oscillator shaped by the piano's envelope and filter.

```json
{
  "trackName": "🎹 Synth Piano",
  "synthType": "triangle",
  "playbackMode": "synth",
  "instrumentPreset": "piano",
  "reverbSend": 0.3,
  "delaySend": 0.05,
  "rowNotes": ["C4", "E4", "G4"],
  "grid": [
    [0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0]
  ]
}
```

What happens per note:

1. **Oscillator**: `triangle` wave starts instantly
2. **Filter envelope**: Cutoff sweeps from `9000 Hz → 2800 Hz` in `70 ms` (Q=0.7) — simulates the hammer strike transient
3. **Amplitude envelope**: `attack: 0.002s`, `decay: 2.2s`, `sustain: 0.0` → note rings and decays to silence like a real piano string
4. **Velocity**: Multiplied by grid value × `velocitySensitivity: 0.9`

**When to use synth mode:**
- You want a consistent piano-like sound regardless of note range
- You're prototyping and don't want sample loading overhead
- You need the piano sound to cut through a dense mix (synth is more controllable)

**When NOT to use synth mode:**
- You want the authentic attack of a real grand piano
- Your listeners are pianists who will notice the triangle wave

---

## 3. Sample Mode (`playbackMode: "sample"`)

Plays real recordings from the Splendid Grand Piano (Steinway D, FF layer, public domain).

```json
{
  "trackName": "🎹 Sample Piano",
  "synthType": "triangle",
  "playbackMode": "sample",
  "sampleSet": "acoustic-piano",
  "instrumentPreset": "piano",
  "reverbSend": 0.35,
  "delaySend": 0.08,
  "rowNotes": ["C4", "E4", "G4"],
  "grid": [
    [0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0]
  ]
}
```

### Sample Resolution Logic

The sample engine doesn't require one file per note. It has **62 FLAC files** spanning the piano range (A0–C8). When a note is requested:

1. **Cache hit** — exact file already loaded → play with `detune = 0`
2. **Cache miss** — search outward from the target MIDI note for the nearest loaded file
3. **No cache** — lazy-load the closest note in range, apply detune correction

```
Request: C#4 (MIDI 61)
Files available: 060_C4.flac, 062_D4.flac
Result: loads 060_C4.flac, applies +100 cents detune
```

Detune is capped at ±100 cents per semitone of difference, applied via `AudioBufferSourceNode.detune`.

### Sample Manifest

Defined in `src/app/data/sample-manifests.ts`:

```typescript
'acoustic-piano': {
  basePath: '/samples/piano/',
  noteRange: [21, 108],              // A0 → C8
  noteToFilename: (note) =>
    `{midi:03d}_{note}.flac`         // e.g. 060_C4.flac, 061_Cs4.flac
}
```

### Filter Envelope in Sample Mode

The same piano filter envelope runs on samples too:
```
initialCutoff: 9000 → finalCutoff: 2800 in 70ms, Q: 0.7
```

This shapes the sample's attack transient, making it sound cohesive with the synth layer when blending.

**When to use sample mode:**
- You want authentic grand piano timbre
- Your melody sits in the mid-range (C3–C6) where the Splendid samples sound best
- You don't need extreme low or high register purity (detune handles nearby notes)

**When NOT to use sample mode:**
- You're composing in a register far from available samples (e.g., extreme bass below A0)
- You need very fast note repetitions (sample buffer loading adds latency on first play)

---

## 4. Layer Mode (`playbackMode: "layer"`)

Plays **synth AND sample simultaneously**, gain-split by `sampleBlend`. Gives you the authentic attack of the Steinway sample PLUS the warm, controllable sustain of the triangle wave.

```json
{
  "trackName": "🎹 Layer Piano",
  "synthType": "triangle",
  "playbackMode": "layer",
  "sampleBlend": 0.45,
  "sampleSet": "acoustic-piano",
  "instrumentPreset": "piano",
  "reverbSend": 0.35,
  "delaySend": 0.08,
  "rowNotes": ["C4", "E4", "G4"],
  "grid": [
    [0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0]
  ]
}
```

### Gain Split Math

```
sampleBlend = 0.45

Synth gain  = velocity × (1 - sampleBlend) = 0.6 × 0.55 = 0.33
Sample gain = velocity × sampleBlend         = 0.6 × 0.45 = 0.27

Total = 0.6 (preserving the original velocity contour)
```

The synth provides the warm body and long sustain; the sample provides the percussive attack transient. Together they sound fuller than either alone.

### Recommended sampleBlend Values

| sampleBlend | Character |
|------------|-----------|
| 0.25 | Mostly synth, subtle sample sparkle on attack |
| 0.45 | Balanced — warm body with clear piano attack (Canon in D default) |
| 0.60 | Sample-dominant — synth just fills the sustain gap |
| 0.75 | Mostly sample — use when samples sound best in your register |

**When to use layer mode:**
- Always — it's the best of both worlds
- Your piano part needs long-decay notes (synth sustains; sample decays)
- You want a recording-quality sound that still cuts through a mix

**When NOT to use layer mode:**
- CPU or memory is constrained (double the processing per note)
- You intentionally want pure synth or pure sample character

---

## 5. Complete JSON Reference

### Top-Level Preset

```json
{
  "name": "My Piece",
  "artist": "Me",
  "bpm": 100,
  "scale": "major",
  "rootNote": "C",
  "stepCount": 16,
  "timeSignature": "4/4",
  "stepResolution": "16th",
  "swingPercentage": 0,
  "tracks": [ /* ... one or more track objects */ ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `bpm` | number (40–200) | Beats per minute. At `stepResolution: "16th"`, each step = quarter ÷ 4 |
| `scale` | string | `"major"`, `"naturalMinor"`, `"harmonicMinor"`, `"melodicMinor"`, `"pentatonicMajor"`, `"pentatonicMinor"` |
| `rootNote` | string | `C, C#, D, D#, E, F, F#, G, G#, A, A#, B` |
| `stepCount` | number (8–336) | Number of grid steps. Loop length = `stepCount ÷ stepResolution × (beats/measure)` |
| `stepResolution` | `"16th"` or `"8th"` | Default `"16th"`. One step by default is a 16th note |
| `timeSignature` | string | `"4/4"`, `"3/4"`, `"6/8"`. Controls measure bar lines in UI |
| `swingPercentage` | 0–50 | Delays odd-indexed steps: `stepDuration × (swingPct/100) × 0.5` |

### Track Fields

```json
{
  "trackName": "🎹 Piano",
  "synthType": "triangle",
  "instrumentPreset": "piano",
  "playbackMode": "sample",
  "sampleBlend": 0.45,
  "sampleSet": "acoustic-piano",
  "reverbSend": 0.35,
  "delaySend": 0.08,
  "rowNotes": ["C4", "E4", "G4"],
  "grid": [
    [0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0, 0,0, 0,0],
    [0,0, 0,0, 0,0, 0,0, 0.6,0, 0,0, 0,0, 0,0]
  ],
  "ties": [
    [f,f, f,f, f,f, f,f, f,f, f,f, f,f, f,f],
    [f,f, f,f, f,f, f,f, f,f, f,f, f,f, f,f],
    [f,f, f,f, f,f, f,f, f,f, f,f, f,f, f,f]
  ]
}
```

| Field | Required | Purpose |
|-------|----------|---------|
| `trackName` | ✅ | Label in the UI track header |
| `synthType` | ✅ | `"triangle"` recommended for piano. Ignored in sample mode, used in synth/layer |
| `instrumentPreset` | ✅ | Must be `"piano"` to get the piano filter envelope + ADSR |
| `playbackMode` | ✅ | `"synth"` / `"sample"` / `"layer"` |
| `sampleBlend` | layer only | Gain split ratio: 0.0 = full synth, 1.0 = full sample |
| `sampleSet` | recommended | `"acoustic-piano"` to use Splendid samples. Inherited from preset if omitted |
| `reverbSend` | optional | 0–1. Room size. 0.3–0.45 for piano concert hall |
| `delaySend` | optional | 0–1. Echo amount. 0.05–0.12 for subtle space |
| `rowNotes` | ✅ | Pitch per grid row. Each string = `Note + Octave` (e.g. `"C#4"`, `"Bb3"` is NOT valid — use sharps only: `"A#3"`) |
| `grid` | ✅ | `number[][]` — `grid[row][step]` = velocity 0–1. Each inner array must be length `stepCount` |
| `ties` | optional | `boolean[][]` — `true` means hold from previous step (legato). Same shape as `grid` |

### Velocity Values

| Grid Value | Dynamics | UI Click Cycle |
|------------|----------|----------------|
| 0 | Off | — |
| 0.1–0.3 | Very soft (pp) | — |
| 0.4–0.6 | Medium (mf) | Click 1: sets 0.6 |
| 0.7–0.9 | Loud (f) | — |
| 1.0 | Maximum (ff) | Click 2: sets 1.0 |
| — | — | Click 3: back to 0 |

The UI cycles: `0 → 0.6 → 1.0 → 0`. Custom float values in the JSON work at playback but can only be reset to 0.6 or 1.0 via clicks.

### Note Format

Only sharps (`#`), never flats (`b`):

| Correct | Wrong |
|---------|-------|
| `C#4` | `Db4` |
| `A#3` | `Bb3` |
| `F#5` | `Gb5` |

Octave range: `A0` (MIDI 21) through `C8` (MIDI 108). All 88 notes are valid in `rowNotes`; the sample engine finds the nearest file and pitch-shifts automatically.

---

## 6. Multi-Track Example: Melody + Bass + Bass Octave

A three-track piano arrangement demonstrating all three modes:

```json
{
  "name": "Piano Trio",
  "artist": "Demo",
  "bpm": 100,
  "scale": "naturalMinor",
  "rootNote": "A",
  "stepCount": 16,
  "timeSignature": "4/4",
  "swingPercentage": 0,
  "tracks": [
    {
      "trackName": "🎵 Melody",
      "synthType": "triangle",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "instrumentPreset": "piano",
      "reverbSend": 0.35,
      "delaySend": 0.08,
      "rowNotes": ["E5", "D#5", "D5", "C5", "B4", "A4", "G#4", "E4"],
      "grid": [
        [1.0,0, 0.8,0, 0.85,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0.75, 0,0.75, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0.85,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0.9, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0.9, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 1.0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 0,0, 0,0.75, 0,0, 0,0]
      ]
    },
    {
      "trackName": "🎹 Accompaniment",
      "synthType": "triangle",
      "playbackMode": "layer",
      "sampleBlend": 0.45,
      "sampleSet": "acoustic-piano",
      "instrumentPreset": "piano",
      "reverbSend": 0.3,
      "delaySend": 0.05,
      "rowNotes": ["A3", "E3", "A2"],
      "grid": [
        [0,0, 0,0, 0,0, 0,0, 0,0.8, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 0,0, 0,0.7, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 1.0,0, 0,0, 0,0, 0,0]
      ]
    },
    {
      "trackName": "🎻 Bass Octave",
      "synthType": "triangle",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "instrumentPreset": "piano",
      "reverbSend": 0.15,
      "delaySend": 0.0,
      "rowNotes": ["A1"],
      "grid": [
        [0,0, 0,0, 0,0, 0,0, 1.0,0, 0,0, 0,0, 0,0]
      ]
    }
  ]
}
```

---

## 7. Common Pitfalls

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `playbackMode` omitted (defaults to `"synth"`) | No sample playback, even with `sampleSet` set | Add `"playbackMode": "sample"` or `"layer"` |
| `sampleSet` omitted | Falls back to synth or instrument preset default | Add `"sampleSet": "acoustic-piano"` |
| `playbackMode: "layer"` without `sampleBlend` | Defaults to 0.5 blend | Set `sampleBlend` explicitly |
| Grid row length != `stepCount` | Playback skips or loops incorrectly | Count your values; each row must match `stepCount` |
| Using flats (`Bb`, `Db`) in `rowNotes` | Note doesn't play, or wrong pitch | Convert to sharps: `A#` for Bb, `C#` for Db, etc. |
| `instrumentPreset` wrong or missing | No filter envelope, synth sounds raw | Set `"instrumentPreset": "piano"` |
| Synth mode with no `synthType` set | TypeScript error at build | Include `"synthType": "triangle"` |
| `bpm` > 180 | CPU struggle, audio glitches | Keep bpm 40–180 |
| Extremely fast note repetitions (< 50ms apart) | Sample engine may choke on back-to-back loads | Use synth or layer mode for dense passages |
| `stepResolution: "8th"` with 16th-note grid data | Everything plays at half speed | Make sure `stepResolution` matches your grid values |

---

## 8. Piano Instrument Preset Reference

Defined in `src/app/data/playlist-presets.ts`:

```typescript
piano: {
  oscType: 'triangle',
  ampAttack: 0.002,        // 2ms — instant hammer strike
  ampDecay: 2.2,           // 2.2s — long natural piano ring
  ampSustain: 0.0,         // decays to silence
  ampRelease: 0.6,         // release tail
  velocitySensitivity: 0.9,// high dynamic response
  filterEnvelope: {
    initialCutoff: 9000,   // Hz — hammer knock brightness
    finalCutoff: 2800,     // Hz — warm settled tone
    rampDuration: 0.07,    // 70ms sweep
    Q: 0.7,                // resonance
  },
}
```

This preset applies to all three modes:
- **Synth**: Uses `oscType`, all ADSR, and filter envelope directly
- **Sample**: Uses filter envelope to shape sample attack; ADSR not applied (sample has its own natural decay)
- **Layer**: Both paths run independently, gain-split by `sampleBlend`

---

## 9. Where to Save Presets

Edit `src/app/data/playlist-presets.ts`. Add your preset object to the `PLAYLIST_PRESETS` array:

```typescript
export const PLAYLIST_PRESETS: SequencePreset[] = [
  // ... existing presets ...

  {
    // your preset object here
  }
];
```

The app picks it up automatically. Run `npx tsc --noEmit` to verify.

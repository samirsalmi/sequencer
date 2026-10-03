# Creating Sample-Based Piano Songs for Loomin

## 1. Full Piano JSON Structure

```json
{
  "name": "Song Title",
  "artist": "Artist Name",
  "bpm": 100,
  "scale": "major",
  "rootNote": "C",
  "stepCount": 16,
  "timeSignature": "4/4",
  "stepResolution": "16th",
  "swingPercentage": 0,
  "tracks": [
    {
      "trackName": "🎹 Piano",
      "synthType": "triangle",
      "instrumentPreset": "piano",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "reverbSend": 0.3,
      "delaySend": 0.0,
      "rowNotes": ["C4", "E4", "G4"],
      "grid": [
        [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,1, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0]
      ]
    }
  ]
}
```

---

## 2. Top-Level Fields

| Field | Type | What it does |
|---|---|---|
| `name` | string | Song title shown in the playlist |
| `artist` | string | Credit line |
| `bpm` | number (60–180) | Tempo — beats per minute |
| `scale` | string | Musical scale for chord/arp helpers: `"major"`, `"naturalMinor"`, `"harmonicMinor"`, `"melodicMinor"`, `"pentatonicMajor"`, `"pentatonicMinor"` |
| `rootNote` | string | Key: `C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B` |
| `stepCount` | number (8–16) | How many steps in the grid loop (8 = half bar, 16 = full bar) |
| `timeSignature` | string, optional | Meter, e.g. `"4/4"`, `"3/4"`, `"6/8"`. Default `"4/4"`. Controls grid beat/measure separator lines. |
| `stepResolution` | `"16th"` or `"8th"`, optional | What one grid step represents. Default `"16th"`. Use `"8th"` for simpler/compound patterns. |
| `swingPercentage` | number (0–100) | Shuffle feel — 0 = straight, ~60 = heavy swing |
| `tracks` | array | Array of track objects |

---

## 3. Track Fields (Piano Sample Mode)

| Field | Type | Required | What it does |
|---|---|---|---|
| `trackName` | string | ✅ | Shown in the track header |
| `synthType` | `"triangle"` | ✅ | Ignored when sampleSet is active, but the JSON requires a value |
| `instrumentPreset` | `"piano"` | ✅ | Links to piano config that defines `sampleSet: "acoustic-piano"` |
| `playbackMode` | `"sample"` | ✅ | Tells engine: play `.wav` files from disk, don't synthesize |
| `sampleSet` | `"acoustic-piano"` | recommended | Explicitly sets the sample set (optional if instrumentPreset defines it) |
| `reverbSend` | 0–1 | optional | Amount of reverb (0 = dry, 1 = cathedral) |
| `delaySend` | 0–1 | optional | Amount of echo/delay |
| `rowNotes` | string[] | ✅ | List of note names — one per row. Each row = one pitch in the grid. |
| `grid` | number[][] | ✅ | Grid of velocities. `grid[row][step]` = velocity 0–1. Each inner array length must equal `stepCount`. |
| `ties` | boolean[][] | optional | `ties[row][step] = true` extends the previous note by one step (legato/sustain). Same shape as `grid`. |

---

## 4. How rowNotes Maps to 88 Piano Keys

**Format:** `Letter + OptionalSharp + Octave`

| Octave Range | Example Notes | MIDI |
|---|---|---|
| A0–G#1 | `A0`, `A#0`, `B0`, `C1`, `C#1`, `D1`, `D#1`, `E1`, `F1`, `F#1`, `G1`, `G#1` | 21–32 |
| A1–G#2 | `A1`, `A#1`, `B1`, `C2`, `C#2`, `D2`, `D#2`, `E2`, `F2`, `F#2`, `G2`, `G#2` | 33–44 |
| A2–G#3 | `A2`, `A#2`, `B2`, `C3`, `C#3`, `D3`, `D#3`, `E3`, `F3`, `F#3`, `G3`, `G#3` | 45–56 |
| A3–G#4 | `A3`, `A#3`, `B3`, `C4`, `C#4`, `D4`, `D#4`, `E4`, `F4`, `F#4`, `G4`, `G#4` | 57–68 |
| A4–G#5 | `A4`, `A#4`, `B4`, `C5`, `C#5`, `D5`, `D#5`, `E5`, `F5`, `F#5`, `G5`, `G#5` | 69–80 |
| A5–G#6 | `A5` – `G#6` | 81–92 |
| A6–G#7 | `A6` – `G#7` | 93–104 |
| B7–C8 | `B7`, `C8` | 105–108 |

**Any of these 88 are valid in `rowNotes`.** The sample engine finds the exact `.wav` file or the nearest available note with automatic pitch shifting (detune).

---

## 5. The Grid — How Notes Play Over Time

Each row in `grid` corresponds to the same-index note in `rowNotes`.

```
rowNotes: ["C4", "E4", "G4"]
grid: [
  [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],  // C4 plays on step 0
  [0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0],  // E4 plays on step 4
  [0,0, 0,0, 0,0, 0,0, 1,0, 0,0, 0,0, 0,0]   // G4 plays on step 8
]
// Result: C4 (step 0), E4 (step 4), G4 (step 8) = C major arpeggio
```

**Velocity values:**
| Value | Meaning |
|---|---|
| 0 | No note |
| 0.1–0.3 | Very soft (pp) |
| 0.4–0.6 | Medium (mf) |
| 0.7–0.9 | Loud (f) |
| 1.0 | Maximum (ff) |

---

## 6. Example Patterns

### 6a. Simple Melody (Single Notes)

```json
{
  "name": "Simple Melody",
  "artist": "Demo",
  "bpm": 100,
  "scale": "major",
  "rootNote": "C",
  "stepCount": 16,
  "timeSignature": "4/4",
  "stepResolution": "16th",
  "tracks": [{
    "trackName": "🎹 Melody",
    "synthType": "triangle",
    "instrumentPreset": "piano",
    "playbackMode": "sample",
    "sampleSet": "acoustic-piano",
    "rowNotes": ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    "grid": [
      [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,1, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,1, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 0,1, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 0,0, 0,1, 0,0, 0,0, 0,0, 0,0]
    ]
  }]
}
```

### 6b. Chords (Stacked Notes on Same Step)

```json
{
  "name": "C G Am F Progression",
  "artist": "Demo",
  "bpm": 90,
  "scale": "major",
  "rootNote": "C",
  "stepCount": 16,
  "timeSignature": "4/4",
  "stepResolution": "16th",
  "tracks": [{
    "trackName": "🎹 Chords",
    "synthType": "triangle",
    "instrumentPreset": "piano",
    "playbackMode": "sample",
    "sampleSet": "acoustic-piano",
    "reverbSend": 0.3,
    "rowNotes": ["C3", "E3", "G3", "A3", "C4", "E4"],
    "grid": [
      [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0],
      [0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0]
    ]
  }]
}
```

### 6c. Two Hands (Melody + Bass in Separate Tracks)

```json
{
  "name": "Two Hands Piano",
  "artist": "Demo",
  "bpm": 80,
  "scale": "naturalMinor",
  "rootNote": "A",
  "stepCount": 16,
  "timeSignature": "4/4",
  "stepResolution": "16th",
  "tracks": [
    {
      "trackName": "🎹 Right Hand — Melody",
      "synthType": "triangle",
      "instrumentPreset": "piano",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "reverbSend": 0.3,
      "rowNotes": ["E5", "D5", "C5", "B4", "A4", "G4"],
      "grid": [
        [1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 1,0, 0,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 1,0, 0,0, 0,0, 0,0],
        [0,0, 0,0, 0,0, 0,0, 0,0, 1,0, 0,0, 0,0]
      ]
    },
    {
      "trackName": "🎹 Left Hand — Bass",
      "synthType": "triangle",
      "instrumentPreset": "piano",
      "playbackMode": "sample",
      "sampleSet": "acoustic-piano",
      "rowNotes": ["A2", "E3", "A3"],
      "grid": [
        [1,0, 0,0, 0.6,0, 0,0, 0.6,0, 0,0, 0,0, 0,0],
        [0,0, 0.7,0, 0,0, 0.7,0, 0,0, 0.7,0, 0,0, 0.7,0],
        [0,0, 0,0, 0,0, 0,0, 1,0, 0,0, 1,0, 0,0]
      ]
    }
  ]
}
```

---

## 7. Rules & Gotchas

| Rule | Why |
|---|---|
| `playbackMode` must be `"sample"` or `"layer"` for `.wav` playback | `"synth"` plays the triangle-wave synth instead |
| `instrumentPreset` must be `"piano"` | This links to the preset that defines `sampleSet: "acoustic-piano"` |
| `synthType` is required but ignored in sample mode | Schema compatibility — the engine uses the preset's config |
| Retro Mode must be **OFF** in the UI | Retro mode bypasses the sample engine entirely |
| Grid arrays must all be length `stepCount` | Mismatched lengths will break playback |
| Use `#` for sharps, never `b` for flats | `C#4` works, `Db4` does not — the note parser only supports sharps |
| `ties` array is optional but must match grid shape if present | Ties let notes sustain across multiple steps |

---

## 8. Where to Save

In `src/app/data/playlist-presets.ts`, add your JSON object to the `PLAYLIST_PRESETS` array:

```typescript
export const PLAYLIST_PRESETS: SequencePreset[] = [
  // ... existing presets ...

  {
    // your JSON here
  }
];
```

The app picks it up automatically in the playlist dropdown.

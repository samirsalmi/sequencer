# Loomin Composer's Guide

How to build music two ways:
1. **From the UI** — click grids, tweak sliders
2. **From JSON** — write presets in `src/app/data/playlist-presets.ts`

---

## Part 1: Building from the UI

### 1.1 Foundation (New Song)

Click **+ New Song** in the Playlist section.

| Setting | Options | Tip |
|---------|---------|-----|
| **BPM** | 40–300 | 120=rock, 140+=metal, 90=hip-hop |
| **Root Note** | A–G, with # | C or E are friendly starting keys |
| **Scale** | Major, Natural Minor, Dorian, Pentatonic | Minor = dark/moody, Major = bright |
| **Steps** | 8–216+ | 16 = 1 bar (4/4 @ 16th), 32 = 2 bars |
| **Time Signature** | 4/4, 3/4, 6/8, 2/4, 5/4 | 4/4 for rock/pop |
| **Resolution** | 16th (detailed), 8th (simple) | 16th for hi-hats/arps |

---

### 1.2 Adding Tracks

Open the **+ New Track** panel. Two approaches:

#### Option A: Pick an Instrument Preset (15 available)

All 15 presets, with their sound character and available sample sets:

| Preset | Waveform | Sample Set | Character | Use For |
|--------|----------|------------|-----------|---------|
| **🎹 Piano** | triangle | `acoustic-piano` (A0–C8) | Hammer-struck, 2.2s decay, filter sweep 9k→2.8k Hz | Melodies, chords, classical |
| **🎹 Upright Piano** | triangle | `vsco-upright` (C2–G8) | Brighter, 2s decay, less resonance | Honky-tonk, indie, pop |
| **🎸 Electric Guitar** | sawtooth | `electric-guitar` (D2–C6) | Clean amp sustain at 0.35, pick transient 8.5k→2.2k Hz | Clean riffs, arpeggios |
| **🎸 Emily Guitar (Warm)** | sawtooth | `karoryfer-guitar` (Bb2–C6) | Flatwound strings, warm EQ, smooth attack | Jazz, clean ballad, fingerstyle |
| **🎸 BJAM Bridge (Aggressive)** | sawtooth | `bjam-guitar` (E3–E5) | Bridge pickup, bright 10k cutoff, Q=2 | Rock rhythm, punk, crunch |
| **🤘 Metal Guitar (Distortion)** | sawtooth + distortion | `bjam-guitar` (E3–E5) | 70% waveshaper saturation, 12k→3k Hz sweep, noise gate | Thrash, palm-mute chugs, metal lead |
| **🎸 Acoustic Guitar (Steel)** | sawtooth | none (synth only) | Steel-string body, 5.5k→1.1k Hz sweep, Q=2.2 | Folk, singer-songwriter |
| **🏛️ Classical Guitar (Nylon)** | triangle | none (synth only) | Nylon warmth, 4k→750 Hz sweep, Q=1.3 | Spanish, classical, bossa nova |
| **🎵 Flute** | triangle | none (synth only) | Breath attack 120ms, sustain 0.9, vibrato 5.5Hz | Lead, pad, ambient |
| **🎵 Flute (Orchestral)** | triangle | `vsco-flute` (C4–C7) | VSCO samples, slower vibrato | Orchestral, cinematic |
| **🎺 Trumpet** | sawtooth | `vsco-trumpet` (F3–D6) | 30ms attack, bright 12k→4k Hz, vibrato 6Hz | Brass stabs, fanfare, mariachi |
| **📯 French Horn** | sawtooth | `vsco-horn` (A0–F5) | 50ms attack, dark 7k→2.5k Hz, Q=2 | Orchestral swell, cinematic |
| **🎻 Violin Section** | sawtooth | `vsco-violin` (G3–D6) | Slow 60ms attack, sustain 0.8, vibrato 5.5Hz | Strings pad, orchestral |
| **🎻 Cello Section** | sawtooth | `vsco-cello` (C2–F5) | Low register, sustain 0.8, vibrato 5Hz | Bass line, dark pad |
| **🥁 Drums** | sine | drum MP3s | Hybrid engine — synth + samples | Any drum pattern |

When a preset is selected, `synthType` is ignored — the preset's oscillator, ADSR, filter, and effects take over.

#### Option B: Pick a Raw Oscillator (5 types)

| Type | Waveform | Sounds Like |
|------|----------|-------------|
| **〰️ Sine** | Pure sine | Sub-bass, 808 kick, theremin, warm pad |
| **🔔 Triangle** | Triangle | Flute, vibraphone, bell, clean arp |
| **🎮 Square** | Square + sub | 8-bit chiptune, punk bass, saw bass |
| **🎸 Sawtooth** | Sawtooth | Lead synth, brass, organ, strings |
| **🎛️ Distortion** | Dual sawtooth + waveshaper | Metal guitar, industrial, dubstep bass |

The Distortion synth has its own parameters (settable per-track):
- `distortion` (0–1): waveshaper saturation amount
- `drive` (0–1): preamp gain into shaper
- `filterCutoff` (200–20000 Hz): cabinet simulation lowpass
- `filterResonance` (0.1–10): Q of the lowpass
- `detune` (0–50 cents): dual-oscillator width
- `envelope`: ADSR (attack 0.001–0.5s, decay 0.01–1s, sustain 0–1, release 0.001–1s)

---

### 1.3 Adding Notes & Drums

Pick your rows from:

**Piano notes**: `[A-G][#]?[0-8]` — e.g., `C4` (middle C), `E2` (bass), `A5` (lead).  
**Supported**: A0 (MIDI 21) through C8 (MIDI 108).

**Drum names** (10 available):

| Name | Sound | Typical Placement |
|------|-------|-------------------|
| `Kick` | Deep thud | Beats 1 & 3 (4/4) |
| `Snare` | Sharp crack | Beats 2 & 4 |
| `Hi-Hat` | Tight chick | Every 8th or 16th note |
| `Open Hi-Hat` | Sizzling wash | Off-beats, accents |
| `Tom Low` | Low floor tom | Fills, rolls |
| `Tom Mid` | Mid rack tom | Fills, rolls |
| `Tom High` | High rack tom | Fills, rolls |
| `Ride` | Shimmering bell | Jazz patterns, steady pulse |
| `Crash` | Explosive accent | Section transitions, beat 1 |
| `Clap` | Electronic handclap | Layered with snare |

With Retro Mode OFF, all drums play real MP3 samples from `/samples/drums/`.

---

### 1.4 Playback Mode (Per Track)

| Mode | What Plays | Best For |
|------|-----------|----------|
| **Synth** | Raw oscillator + instrument preset DSP | Chiptune, retro, when no samples exist |
| **Sample** | Real `.wav`/`.flac` files from `sampleSet` | Piano, guitar, orchestral (realistic) |
| **Layer** | Both synth + sample blended | Adding synth texture to real samples |

The `sampleBlend` slider (0–1, visible in Layer mode) controls the mix: 0 = full synth, 1 = full sample.

---

### 1.5 Grid Controls

- **Click cell**: cycles velocity: `0` → `0.6` (normal) → `1` (accent) → `0`
- **Shift+Click**: toggle tie (sustain across steps)
- **Swing slider**: delays even 16th steps for shuffle feel
- **Arp toggle**: arpeggiates simultaneous notes into a roll (Up/Down/Invert/Random)

### 1.6 FX Panel

| Effect | Per-Track | Global |
|--------|-----------|--------|
| **Delay** | Send level (0–1) | Time (50–1000ms), Feedback (0–0.95) |
| **Reverb** | Send level (0–1) | Mix (0–1), 2s synthetic impulse |
| **Track Filter** | Dedicated LPF per channel | — |
| **LFO** | — | Rate (0.1–20Hz), Depth (0–2000), Freq (200–20kHz) |
| **Portamento** | Glide time (ms) per track | — |

---

## Part 2: Building from JSON

Edit `src/app/data/playlist-presets.ts`. The `PLAYLIST_PRESETS` array holds all built-in songs.

### 2.1 Preset Structure

```typescript
{
  name: 'My Song',           // display name in Playlist dropdown
  artist: 'My Band',
  bpm: 120,                  // 40–300
  scale: 'naturalMinor',     // major | naturalMinor | dorian | pentatonic
  rootNote: 'E',             // C C# D D# E F F# G G# A A# B
  stepCount: 32,             // grid width
  timeSignature: '4/4',      // 4/4 3/4 6/8 2/4 5/4
  stepResolution: '16th',    // 16th | 8th
  swingPercentage: 0,        // 0–75
  tracks: [ /* see below */ ]
}
```

### 2.2 Track Object

```typescript
{
  trackName: '🎸 Lead',
  synthType: 'sawtooth',               // sine | triangle | square | sawtooth | distortion

  // Optional: instrument preset (overrides synthType)
  instrumentPreset: 'metalGuitar',     // key into INSTRUMENT_PRESETS

  // Optional: sample playback
  playbackMode: 'sample',              // synth | sample | layer
  sampleSet: 'bjam-guitar',            // key into SAMPLE_SETS
  sampleBlend: 0.5,                    // 0–1, layer mode only

  // Distortion-specific (synthType: "distortion" only)
  distortion: 0.7,                     // waveshaper saturation
  drive: 0.6,                          // preamp drive
  filterCutoff: 3500,                  // cabinet LPF (Hz)
  filterResonance: 1,                  // LPF Q
  detune: 10,                          // dual-osc detune (cents)
  envelope: {                          // ADSR
    attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1
  },

  // FX sends
  delaySend: 0.2,                      // 0–1
  reverbSend: 0.4,                     // 0–1
  portamento: 0,                       // glide ms

  // Arpeggiator
  arpEnabled: false,                   // true | false
  arpPattern: 'up',                    // up | down | invert | random

  // Notes & grid
  rowNotes: ['E3', 'G3', 'A3', 'B3'], // each = one row
  grid: [
    [1,0.8,1,0.8, 0,0,0,0, 0,0,0,0, 0,0,0,0],  // row 0
    [0,0,0,0, 1,0.8,1,0.8, 0,0,0,0, 0,0,0,0],  // row 1
    // ... one array per rowNotes entry
  ],
  ties: [                              // optional, default all false
    [f,f,f,f, f,f,f,f, f,f,f,f, f,f,f,f],
    // ...
  ]
}
```

**Grid values**: `0` = off, `0.6` = normal, `1` = accent.  
**Ties**: `true` = sustain previous step's note through this step.

### 2.3 Power Chords in the Grid

Since each row = one note, build power chords by assigning root + 5th to separate rows:

```typescript
rowNotes: ['E3', 'B3', 'G3', 'D4', 'A3', 'E4', 'B3', 'F#4'],
//         E5 root  E5 5th  G5 root  G5 5th  A5 root  A5 5th  B5 root  B5 5th
```

Then place both notes of each chord on the same step to simulate a power chord hit.

### 2.4 Full Instrument Reference Table

**All instrument presets** (key → label):

| Key | Label | oscType | Sample Set | ADSR | Filter | Extra |
|-----|-------|---------|-----------|------|--------|-------|
| `piano` | 🎹 Piano | triangle | acoustic-piano | A:0.002 D:2.2 S:0.0 R:0.6 | 9k→2.8k, 70ms, Q=0.7 | — |
| `uprightPiano` | 🎹 Upright Piano | triangle | vsco-upright | A:0.002 D:2.0 S:0.0 R:0.5 | 8k→2k, 70ms, Q=0.7 | — |
| `guitar` | 🎸 Electric Guitar | sawtooth | electric-guitar | A:0.003 D:0.5 S:0.35 R:0.3 | 8.5k→2.2k, 120ms, Q=1.5 | — |
| `karoryferGuitar` | 🎸 Emily Guitar (Warm) | sawtooth | karoryfer-guitar | A:0.003 D:0.5 S:0.35 R:0.3 | 9k→2k, 120ms, Q=1.5 | Flatwound strings |
| `bjamGuitar` | 🎸 BJAM Bridge (Aggressive) | sawtooth | bjam-guitar | A:0.003 D:0.7 S:0.3 R:0.25 | 10k→2.5k, 100ms, Q=2 | Bridge pickup |
| `metalGuitar` | 🤘 Metal Guitar (Distortion) | sawtooth | bjam-guitar | A:0.003 D:0.5 S:0.2 R:0.15 | 12k→3k, 50ms, Q=2.5 | distortion: 0.7, 4x oversample |
| `acousticGuitar` | 🎸 Acoustic Guitar | sawtooth | none | A:0.002 D:2.4 S:0.0 R:0.2 | 5.5k→1.1k, 280ms, Q=2.2 | Steel-string |
| `classicalGuitar` | 🏛️ Classical Guitar | triangle | none | A:0.004 D:3.5 S:0.0 R:0.3 | 4k→750, 320ms, Q=1.3 | Nylon-string |
| `flute` | 🎵 Flute | triangle | none | A:0.12 D:0.2 S:0.9 R:0.15 | none | vibrato 5.5Hz ±3.2 |
| `orchestralFlute` | 🎵 Flute | triangle | vsco-flute | A:0.1 D:0.15 S:0.85 R:0.15 | 10k→3k, 100ms, Q=1 | vibrato 5.5Hz ±3.5 |
| `trumpet` | 🎺 Trumpet | sawtooth | vsco-trumpet | A:0.03 D:0.2 S:0.8 R:0.15 | 12k→4k, 150ms, Q=1.2 | vibrato 6Hz ±2 |
| `frenchHorn` | 📯 French Horn | sawtooth | vsco-horn | A:0.05 D:0.2 S:0.85 R:0.2 | 7k→2.5k, 200ms, Q=2 | vibrato 5Hz ±1.5 |
| `violin` | 🎻 Violin Section | sawtooth | vsco-violin | A:0.06 D:0.3 S:0.8 R:0.2 | 8k→2k, 300ms, Q=1.5 | vibrato 5.5Hz ±3 |
| `cello` | 🎻 Cello Section | sawtooth | vsco-cello | A:0.04 D:0.3 S:0.8 R:0.2 | 9k→1.5k, 250ms, Q=1.8 | vibrato 5Hz ±2.5 |
| `drums` | 🥁 Drums | sine | drum MP3s | A:0.001 D:0.3 S:0.0 R:0.1 | none | Hybrid engine |

**All sample sets** (key → details):

| Key | Source | Files | Range |
|-----|--------|-------|-------|
| `acoustic-piano` | Splendid Grand Piano (Steinway D) | 88 FLACs `{midi}_{note}.flac` | A0–C8 |
| `electric-guitar` | cluesurf/wave | WAVs per string `string-{n}-{note}.wav` | D2–C6 |
| `electric-bass` | cluesurf/wave | WAVs per string `string-{n}-{note}.wav` | E1–G3 |
| `vsco-violin` | VSCO 2 CE | `Violin_susVib_{note}.flac` | G3–D6 |
| `vsco-cello` | VSCO 2 CE | `Cello_susvib_{note}.flac` | C2–F5 |
| `vsco-flute` | VSCO 2 CE | `Flute_susvib_{note}.flac` | C4–C7 |
| `vsco-trumpet` | VSCO 2 CE | `Trumpet_sus_{note}.flac` | F3–D6 |
| `vsco-horn` | VSCO 2 CE | `FHorn_sus_{note}.flac` | A0–F5 |
| `vsco-upright` | VSCO 2 CE | `Upright_{note}.flac` | C2–G8 |
| `karoryfer-guitar` | Karoryfer Emily Guitar | `Emily_{note}.flac` | Bb2–C6 |
| `bjam-guitar` | VSCO 2 CE + BJAM | `BJAM_{note}.flac` + `BJAMchug_{note}.flac` | E3–E5 |

**All synth types**:

| Type | Engine | Parameters |
|------|--------|------------|
| `sine` | PolySynth | none |
| `triangle` | PolySynth | none |
| `square` | BassSynth | none (square + sub osc + saturation) |
| `sawtooth` | PolySynth | none |
| `distortion` | DistortionSynth | distortion, drive, filterCutoff, filterResonance, detune, envelope (ADSR) |

**All drum names** (routed to DrumEngine + MP3 samples):

`Kick` `Snare` `Hi-Hat` `Open Hi-Hat` `Tom Low` `Tom Mid` `Tom High` `Ride` `Crash` `Clap`

---

### 2.5 Example: Minimal Preset (16 steps, 2 tracks)

```typescript
{
  name: 'Minimal Groove',
  artist: 'Demo',
  bpm: 120,
  scale: 'naturalMinor',
  rootNote: 'E',
  stepCount: 16,
  timeSignature: '4/4',
  tracks: [
    {
      trackName: 'Drums',
      synthType: 'sine',
      playbackMode: 'sample',
      rowNotes: ['Kick', 'Snare', 'Hi-Hat'],
      grid: [
        [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        [0.6,0,0.6,0, 0.6,0,0.6,0, 0.6,0,0.6,0, 0.6,0,0.6,0]
      ]
    },
    {
      trackName: 'Bass',
      synthType: 'square',
      rowNotes: ['E2', 'G2', 'A2', 'B2'],
      grid: [
        [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
        [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0]
      ]
    }
  ]
}
```

Append it to `PLAYLIST_PRESETS` and it appears in the dropdown automatically — no other code changes needed.

---

## Part 3: Songwriting Workflow

1. **Drums first** — lock in the groove with Kick/Snare/Hi-Hat
2. **Bass** — follow the root notes, use ties for sustain
3. **Chords/Pad** — use Piano or Triangle synth in mid octave, enable Arp for movement
4. **Melody** — Sawtooth or Piano in upper octave, add delay for space
5. **FX** — reverb on pads, delay on leads, filter sweep for transitions

### Velocity Dynamics

Three-state cells: `0` (off) → `0.6` (normal) → `1` (accent). Use accents on downbeats, ghost notes (0.6) for off-beat hi-hats and grace notes.

### Ties

Shift+Click a cell to toggle tie. The note that started on the previous step sustains through this step instead of retriggering. Essential for legato bass lines and pad swells.

### Swing

Delays even-indexed 16th steps by `swingPercentage × stepDuration × 0.5`. 0 = straight, 30 = deep shuffle, 75 = maximum.

---

## Limitations

- **No audio export** — MP3/WAV/MIDI export is not available
- **Browser storage only** — custom songs live in `localStorage`, cleared on browser data reset
- **Sample loading** — 88-file piano set causes brief async load when Retro Mode is OFF
- **BPM range** — 40–300
- **Grid size** — no hard max, but large grids (216+ steps) with many tracks may stutter on older devices

import { midiToNote, noteToMidi } from '../utils/music-theory';

export interface SampleSet {
  name: string;
  label: string;
  basePath: string;
  /** Sounding MIDI pitch → filename. Only files that really exist (and are at the right pitch) are listed. */
  samples: ReadonlyMap<number, string>;
  /** Lowest / highest sounding MIDI note with a sample. */
  noteRange: [number, number];
  /** Truncate the playback envelope to this many seconds (cuts excessive tail buildup). */
  releaseSeconds?: number;
  /**
   * Sustained instruments (bowed strings, winds, brass) stop at the end of the grid note plus a short release.
   * Plucked / struck instruments (piano, guitar) ring out naturally up to `releaseSeconds`.
   */
  sustained?: boolean;
}

/** Builds a sample map from the note names used in the filenames. `octaveShift` corrects files whose names are off by octaves. */
function buildSamples(fileNotes: string[], toFilename: (fileNote: string) => string, octaveShift = 0): Map<number, string> {
  const map = new Map<number, string>();
  for (const fileNote of fileNotes) map.set(noteToMidi(fileNote) + 12 * octaveShift, toFilename(fileNote));
  return map;
}

function rangeOf(samples: ReadonlyMap<number, string>): [number, number] {
  const keys = [...samples.keys()];
  return [Math.min(...keys), Math.max(...keys)];
}

const sharpToS = (note: string) => note.replace('#', 's');
const midiSpan = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

// ── Piano: Splendid Grand Piano (Public Domain / AKAI) ───────────────────
// Steinway D concert grand, FF velocity layer. Files: {midi:03d}_{note}.flac  e.g. 060_C4.flac, 061_Cs4.flac
// scripts/fill-piano-notes.mjs filled gaps by copying the neighbouring sample WITHOUT re-pitching it, so these
// files are byte-identical copies that sound at the wrong pitch. They are excluded; the engine re-pitches the
// nearest real sample instead. (Verified by blob hash + pitch detection.)
const PIANO_WRONG_PITCH_COPIES = new Set([
  21, 22, 24, 25, 26, 28, 30, 32, 34, 36, 39, 42, 44, 46, 49, 51, 54, 61, 63, 66, 68, 70, 73, 75, 78, 84,
]);
const PIANO_SAMPLES = buildSamples(
  midiSpan(21, 108).filter(m => !PIANO_WRONG_PITCH_COPIES.has(m)).map(midiToNote),
  note => `${String(noteToMidi(note)).padStart(3, '0')}_${sharpToS(note)}.flac`,
);

// ── Guitar: cluesurf/wave (Public Domain) ──────────────────────────────
// Files: string-{n}-{letter}-as-{note}.wav  e.g. string-6-D-as-D2.wav
// Sharp notes use 'x' suffix: D#2 → string-6-Dx-as-Dx2.wav
// Range: D2(38) - C6(84)
const GUITAR_EXISTING_MIDI = new Set(
  Array.from({ length: 84 - 38 + 1 }, (_, i) => 38 + i).filter(midi => {
    if (midi === 48 || midi === 49) return false; // string-5 C3 / C#3 not sampled
    return true;
  })
);

const guitarNoteToFilename = (note: string): string | null => {
  try {
    const midi = noteToMidi(note);
    if (!GUITAR_EXISTING_MIDI.has(midi)) return null;
    const m = note.match(/^([A-G])(#?)(-?\d+)$/);
    if (!m) return null;
    const letter = m[1];
    const sharp = m[2] === '#' ? 'x' : '';
    const octave = m[3];
    const noteName = `${letter}${sharp}${octave}`;
    const displayLetter = sharp ? `${letter}x` : letter;
    const stringNum = guessGuitarString(midi);
    return `string-${stringNum}-${displayLetter}-as-${noteName}.wav`;
  } catch {
    return null;
  }
};

function guessGuitarString(midi: number): number {
  if (midi >= 64) return 1;  // E4+
  if (midi >= 59) return 2;  // B3+
  if (midi >= 55) return 3;  // G3+
  if (midi >= 50) return 4;  // D3+
  if (midi >= 45) return 5;  // A2+
  return 6;                   // E2- / D2
}

// ── Bass: cluesurf/wave (Public Domain) ────────────────────────────────
// Same naming convention as guitar
// Range: E1(28) - G3(55)
// NOTE: the guitar/ and bass/ WAVs in samirsalmi/samples are stored with Git LFS, so the CDN serves 132-byte
// pointer files instead of audio. They fail to decode and the engine falls back to the synth until real files
// are committed (see docs/sample-library.md).
const bassNoteToFilename = (note: string): string | null => {
  try {
    const midi = noteToMidi(note);
    if (midi < 28 || midi > 55) return null;
    const m = note.match(/^([A-G])(#?)(-?\d+)$/);
    if (!m) return null;
    const letter = m[1];
    const sharp = m[2] === '#' ? 'x' : '';
    const octave = m[3];
    const noteName = `${letter}${sharp}${octave}`;
    const displayLetter = sharp ? `${letter}x` : letter;
    const stringNum = guessBassString(midi);
    return `string-${stringNum}-${displayLetter}-as-${noteName}.wav`;
  } catch {
    return null;
  }
};

function guessBassString(midi: number): number {
  if (midi >= 43) return 1;  // G2+
  if (midi >= 38) return 2;  // D2+
  if (midi >= 33) return 3;  // A1+
  return 4;                   // E1-
}

const GUITAR_SAMPLES = buildSamples([...GUITAR_EXISTING_MIDI].map(midiToNote), n => guitarNoteToFilename(n)!);
const BASS_SAMPLES = buildSamples(midiSpan(28, 55).map(midiToNote), n => bassNoteToFilename(n)!);

// ── Drums: teropa/drumkit ──────────────────────────────────────────────
// Maps drum names to filenames (MP3 from teropa/drumkit, saved in kebab-case)
const drumFiles: Record<string, string> = {
  'Kick': 'kick.mp3',
  'Snare': 'snare.mp3',
  'Hi-Hat': 'hat-closed.mp3',
  'Open Hi-Hat': 'hat-open.mp3',
  'Tom Low': 'tom-low.mp3',
  'Tom Mid': 'tom-mid.mp3',
  'Tom High': 'tom-high.mp3',
  'Ride': 'ride.mp3',
  'Crash': 'crash.mp3',
};

// ── VSCO 2 CE Orchestral Samples (CC0) ──────────────────────────────────
// Sustain articulation, mid velocity layer, WAV→FLAC. Naming: {Prefix}_{Note_with_s_for_sharp}.flac
// VSCO names files with the "middle C = C3" convention: Violin_susVib_A3 actually sounds A4 (440 Hz).
// octaveShift = 1 maps every file to its real sounding pitch (verified with pitch detection).
const VSCO_OCTAVE_SHIFT = 1;
const vsco = (prefix: string, fileNotes: string[]) =>
  buildSamples(fileNotes, n => `${prefix}_${sharpToS(n)}.flac`, VSCO_OCTAVE_SHIFT);

const VIOLIN_SAMPLES = vsco('Violin_susVib', ['G2', 'A2', 'B2', 'D3', 'F#3', 'A3', 'C4', 'E4', 'G4', 'B4', 'D5']);
const CELLO_SAMPLES = vsco('Cello_susvib', ['C1', 'E1', 'G1', 'B1', 'D2', 'F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4']);
const FLUTE_SAMPLES = vsco('Flute_susvib', ['C3', 'E3', 'A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6']);
const TRUMPET_SAMPLES = vsco('Trumpet_sus', ['F2', 'A2', 'C3', 'D#3', 'G3', 'A#3', 'D4', 'F4', 'A4', 'C5']);
const HORN_SAMPLES = vsco('FHorn_sus', ['A0', 'C1', 'D#1', 'G1', 'A#1', 'D2', 'F2', 'A2', 'C3', 'D4', 'F4']);

// ── Upright Piano KW (CC0, freepats.zenvoid.org) ──────────────────────
// Files: {Note}vH.flac  e.g. A0vH.flac, Ds3vH.flac — only the SFZ pitch_keycenter notes exist;
// the engine re-pitches the nearest one for every other key.
const UPRIGHT_SAMPLES = buildSamples(
  [21, 23, 24, 27, 30, 33, 35, 36, 39, 42, 47, 48, 51, 54, 57, 59, 63, 66, 69, 71,
   72, 75, 78, 81, 83, 84, 87, 90, 93, 95, 96, 99, 102, 105, 107, 108].map(midiToNote),
  n => `${sharpToS(n)}vH.flac`,
);

// ── Karoryfer Emily Guitar / BJAM (correct pitch as named) ─────────────
const EMILY_SAMPLES = buildSamples(
  ['C#2', 'E2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D6'],
  n => `Emily_${sharpToS(n)}.flac`,
);
const BJAM_SAMPLES = buildSamples(['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], n => `BJAM_${sharpToS(n)}.flac`);

// ── Sample Sets ────────────────────────────────────────────────────────

export const SAMPLE_SETS: Record<string, SampleSet> = {
  'acoustic-piano': {
    name: 'acoustic-piano',
    label: 'Acoustic Piano',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/piano/',
    samples: PIANO_SAMPLES,
    noteRange: rangeOf(PIANO_SAMPLES),
    releaseSeconds: 4.0,
  },
  'electric-guitar': {
    name: 'electric-guitar',
    label: 'Electric Guitar',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/guitar/',
    samples: GUITAR_SAMPLES,
    noteRange: rangeOf(GUITAR_SAMPLES),
    releaseSeconds: 1.0,
  },
  'electric-bass': {
    name: 'electric-bass',
    label: 'Electric Bass',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/bass/',
    samples: BASS_SAMPLES,
    noteRange: rangeOf(BASS_SAMPLES),
    releaseSeconds: 1.0,
  },

  // ── VSCO 2 CE Orchestral ──────────────────────────────────────────────
  'vsco-violin': {
    name: 'vsco-violin',
    label: 'Violin Section',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-violin/',
    samples: VIOLIN_SAMPLES,
    noteRange: rangeOf(VIOLIN_SAMPLES),
    sustained: true,
  },
  'vsco-cello': {
    name: 'vsco-cello',
    label: 'Cello Section',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-cello/',
    samples: CELLO_SAMPLES,
    noteRange: rangeOf(CELLO_SAMPLES),
    sustained: true,
  },
  'vsco-flute': {
    name: 'vsco-flute',
    label: 'Flute',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-flute/',
    samples: FLUTE_SAMPLES,
    noteRange: rangeOf(FLUTE_SAMPLES),
    sustained: true,
  },
  'vsco-trumpet': {
    name: 'vsco-trumpet',
    label: 'Trumpet',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-trumpet/',
    samples: TRUMPET_SAMPLES,
    noteRange: rangeOf(TRUMPET_SAMPLES),
    sustained: true,
  },
  'vsco-horn': {
    name: 'vsco-horn',
    label: 'French Horn',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-horn/',
    samples: HORN_SAMPLES,
    noteRange: rangeOf(HORN_SAMPLES),
    sustained: true,
  },
  'vsco-upright': {
    name: 'vsco-upright',
    label: 'Upright Piano KW',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-upright/',
    samples: UPRIGHT_SAMPLES,
    noteRange: rangeOf(UPRIGHT_SAMPLES),
    releaseSeconds: 1.5,
  },
  'karoryfer-guitar': {
    name: 'karoryfer-guitar',
    label: 'Karoryfer Emily Guitar',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/karoryfer-guitar/',
    samples: EMILY_SAMPLES,
    noteRange: rangeOf(EMILY_SAMPLES),
  },
  'bjam-guitar': {
    name: 'bjam-guitar',
    label: 'BJAM Guitar',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/bjam-guitar/',
    samples: BJAM_SAMPLES,
    noteRange: rangeOf(BJAM_SAMPLES),
  },
};

/** Maps drum note names to relative sample paths */
export function getDrumSamplePath(drumName: string): string | null {
  const file = drumFiles[drumName];
  if (!file) return null;
  return `https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/drums/${file}`;
}

/** Returns the sample set for a given drum name, or null */
export function drumHasSample(drumName: string): boolean {
  return drumName in drumFiles;
}

/** URL of the sample recorded at exactly `midi`, or null if the set has none. */
export function sampleUrl(set: SampleSet, midi: number): string | null {
  const file = set.samples.get(midi);
  return file ? `${set.basePath}${file}` : null;
}

/** Sample MIDI notes ordered by distance from `midi` (closest first, lower pitch wins ties). */
export function samplesByDistance(set: SampleSet, midi: number, maxDistance = 12): number[] {
  return [...set.samples.keys()]
    .filter(m => Math.abs(m - midi) <= maxDistance)
    .sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi) || a - b);
}

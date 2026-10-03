export interface SampleSet {
  name: string;
  label: string;
  basePath: string;
  noteRange: [number, number];
  defaultNote: string;
  noteToFilename(note: string): string | null;
  /** Truncate the playback envelope to this many seconds (cuts excessive tail buildup). */
  releaseSeconds?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToMidi(note: string): number {
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) throw new Error(`Invalid note: ${note}`);
  const name = m[1];
  const octave = parseInt(m[2], 10);
  const idx = NOTE_NAMES.indexOf(name);
  if (idx === -1) throw new Error(`Invalid note name: ${name}`);
  return (octave + 1) * 12 + idx;
}

function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

// ── Piano: Splendid Grand Piano (Public Domain / AKAI) ───────────────────
// Steinway D concert grand, FF velocity layer
// Files: {midi:03d}_{note}.flac  e.g. 060_C4.flac, 061_Cs4.flac
// Range: A0(21) - C8(108)
const pianoNoteToFilename = (note: string): string | null => {
  try {
    const midi = noteToMidi(note);
    if (midi < 21 || midi > 108) return null;
    return `${String(midi).padStart(3, '0')}_${note.replace('#', 's')}.flac`;
  } catch {
    return null;
  }
};

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
// Each instrument: sustain articulation, mid velocity layer, WAV→FLAC
// Naming: {Prefix}_{Note_with_s_for_sharp}.flac  e.g. Violin_susVib_Cs4.flac

function makeVscoMapper(prefix: string, minMidi: number, maxMidi: number): (note: string) => string | null {
  return (note: string) => {
    try {
      const midi = noteToMidi(note);
      if (midi < minMidi || midi > maxMidi) return null;
      return `${prefix}_${note.replace('#', 's')}.flac`;
    } catch { return null; }
  };
}

const violinNoteToFilename = makeVscoMapper('Violin_susVib', 43, 74);
const celloNoteToFilename = makeVscoMapper('Cello_susvib', 24, 65);
const fluteNoteToFilename = makeVscoMapper('Flute_susvib', 48, 84);
const trumpetNoteToFilename = makeVscoMapper('Trumpet_sus', 41, 72);
const hornNoteToFilename = makeVscoMapper('FHorn_sus', 21, 65);
// ── Upright Piano KW (CC0, freepats.zenvoid.org) ──────────────────────
// Files: {Note}vH.flac  e.g. A0vH.flac, D#3vH.flac
// Two velocity layers in source; we use the vH (high-velocity) layer.
// Each sample covers a range of keys in the SFZ — we register only the
// pitch_keycenter notes so the engine's detune fallback handles the rest.
const UPRIGHT_CENTER_NOTES = new Set([
  21, 23, 24, 27, 30, 33, 35, 36, 39, 42,
  47, 48, 51, 54, 57, 59, 63, 66, 69, 71,
  72, 75, 78, 81, 83, 84, 87, 90, 93, 95,
  96, 99, 102, 105, 107, 108,
]);
const uprightNoteToFilename = (note: string): string | null => {
  try {
    const midi = noteToMidi(note);
    if (!UPRIGHT_CENTER_NOTES.has(midi)) return null;
    return `${note.replace('#', 's')}vH.flac`;
  } catch { return null; }
};
const emilyNoteToFilename = makeVscoMapper('Emily', 37, 84);
const bjamSustainNoteToFilename = makeVscoMapper('BJAM', 40, 64);
const bjamChugNoteToFilename = makeVscoMapper('BJAMchug', 40, 64);

// ── Sample Sets ────────────────────────────────────────────────────────

export const SAMPLE_SETS: Record<string, SampleSet> = {
  'acoustic-piano': {
    name: 'acoustic-piano',
    label: 'Acoustic Piano',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/piano/',
    noteRange: [21, 108],
    defaultNote: 'C4',
    noteToFilename: pianoNoteToFilename,
    releaseSeconds: 4.0,
  },

  'electric-guitar': {
    name: 'electric-guitar',
    label: 'Electric Guitar',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/guitar/',
    noteRange: [38, 84],
    defaultNote: 'E3',
    noteToFilename: guitarNoteToFilename,
    releaseSeconds: 1.0,
  },
  'electric-bass': {
    name: 'electric-bass',
    label: 'Electric Bass',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/bass/',
    noteRange: [26, 56],
    defaultNote: 'E2',
    noteToFilename: bassNoteToFilename,
    releaseSeconds: 1.0,
  },

  // ── VSCO 2 CE Orchestral ──────────────────────────────────────────────
  'vsco-violin': {
    name: 'vsco-violin',
    label: 'Violin Section',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-violin/',
    noteRange: [43, 74],
    defaultNote: 'C4',
    noteToFilename: violinNoteToFilename,
  },
  'vsco-cello': {
    name: 'vsco-cello',
    label: 'Cello Section',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-cello/',
    noteRange: [24, 65],
    defaultNote: 'C3',
    noteToFilename: celloNoteToFilename,
  },
  'vsco-flute': {
    name: 'vsco-flute',
    label: 'Flute',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-flute/',
    noteRange: [48, 84],
    defaultNote: 'C4',
    noteToFilename: fluteNoteToFilename,
  },
  'vsco-trumpet': {
    name: 'vsco-trumpet',
    label: 'Trumpet',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-trumpet/',
    noteRange: [41, 72],
    defaultNote: 'C4',
    noteToFilename: trumpetNoteToFilename,
  },
  'vsco-horn': {
    name: 'vsco-horn',
    label: 'French Horn',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-horn/',
    noteRange: [21, 65],
    defaultNote: 'C3',
    noteToFilename: hornNoteToFilename,
  },
  'vsco-upright': {
    name: 'vsco-upright',
    label: 'Upright Piano KW',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/vsco-upright/',
    noteRange: [21, 108],
    defaultNote: 'C4',
    noteToFilename: uprightNoteToFilename,
    releaseSeconds: 1.5,
  },
  'karoryfer-guitar': {
    name: 'karoryfer-guitar',
    label: 'Karoryfer Emily Guitar',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/karoryfer-guitar/',
    noteRange: [37, 84],
    defaultNote: 'A3',
    noteToFilename: emilyNoteToFilename,
  },
  'bjam-guitar': {
    name: 'bjam-guitar',
    label: 'BJAM Guitar',
    basePath: 'https://cdn.jsdelivr.net/gh/samirsalmi/samples@main/bjam-guitar/',
    noteRange: [40, 64],
    defaultNote: 'E3',
    noteToFilename: bjamSustainNoteToFilename,
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

/** Resolves a note to its sample URL for a given sample set */
export function resolveSampleUrl(set: SampleSet, note: string): string | null {
  const filename = set.noteToFilename(note);
  if (!filename) return null;
  return `${set.basePath}${filename}`;
}

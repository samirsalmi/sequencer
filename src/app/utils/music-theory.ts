// Single source of truth for note names, scales and chords.
// Notes are written in scientific pitch notation with sharps as the canonical spelling ("C#4");
// flats ("Bb2") and negative / multi-digit octaves are accepted on input.

export const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Cb: 'B', Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#',
  'E#': 'F', 'B#': 'C',
};

export const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};

const CHORD_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  minorMajor7: [0, 3, 7, 11],
};

/** Returns the pitch class (0–11) of a note letter like "C#", "Bb" or "A". -1 if invalid. */
export function pitchClass(name: string): number {
  const canonical = FLAT_TO_SHARP[name] ?? name;
  return (CHROMATIC as readonly string[]).indexOf(canonical);
}

export function noteToMidi(note: string): number {
  const m = note.trim().match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!m) throw new Error(`Invalid note name: ${note}`);
  const pc = pitchClass(m[1] + m[2]);
  if (pc === -1) throw new Error(`Invalid note name: ${note}`);
  // E#/B# wrap into the next pitch class without changing the written octave
  const octaveShift = m[1] + m[2] === 'B#' ? 1 : m[1] + m[2] === 'Cb' ? -1 : 0;
  return (parseInt(m[3], 10) + 1 + octaveShift) * 12 + pc;
}

export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${CHROMATIC[((midi % 12) + 12) % 12]}${octave}`;
}

/** Canonical (sharp) spelling of a note, e.g. "Bb2" → "A#2". Returns null if invalid. */
export function normalizeNote(note: string): string | null {
  try { return midiToNote(noteToMidi(note)); } catch { return null; }
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteToFrequency(note: string): number {
  return midiToFrequency(noteToMidi(note));
}

/** One octave of a scale starting at `rootNote` in `octave`, e.g. ("A", "naturalMinor", 4) → A4 B4 C5 … */
export function getScaleNotes(rootNote: string, scale: string, octave = 4): string[] {
  const pc = pitchClass(rootNote);
  if (pc === -1) return [];
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS['major'];
  const rootMidi = (octave + 1) * 12 + pc;
  return intervals.map(i => midiToNote(rootMidi + i));
}

/**
 * Diatonic chord built on a 1-based scale degree by stacking thirds inside the scale,
 * so the quality is always correct for the chosen scale (e.g. degree 1 of naturalMinor is minor).
 */
export function getChordNotes(rootNote: string, scale: string, degree: number, seventh = false, octave = 4): string[] {
  const pc = pitchClass(rootNote);
  if (pc === -1) return [];
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS['major'];
  const size = intervals.length;
  const rootMidi = (octave + 1) * 12 + pc;
  const tone = (step: number) => rootMidi + intervals[step % size] + 12 * Math.floor(step / size);

  const d = (((degree - 1) % size) + size) % size;
  // Pentatonic scales have no real thirds; fall back to the matching triad quality.
  if (size !== 7) {
    const chordRoot = tone(d);
    const third = intervals.includes((intervals[d] + 4) % 12) ? 4 : 3;
    const chord = third === 4 ? CHORD_INTERVALS[seventh ? 'dom7' : 'major'] : CHORD_INTERVALS[seventh ? 'minor7' : 'minor'];
    return chord.map(i => midiToNote(chordRoot + i));
  }
  const stack = seventh ? [0, 2, 4, 6] : [0, 2, 4];
  return stack.map(s => midiToNote(tone(d + s)));
}

/** Names the quality of a chord built from MIDI notes (root first). Exposed for tests and UI labels. */
export function chordQuality(notes: string[]): string | null {
  const midis = notes.map(noteToMidi);
  const rel = midis.map(m => m - midis[0]);
  const key = rel.join(',');
  return Object.entries(CHORD_INTERVALS).find(([, iv]) => iv.join(',') === key)?.[0] ?? null;
}

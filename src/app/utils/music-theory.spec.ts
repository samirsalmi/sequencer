import { chordQuality, getChordNotes, getScaleNotes, midiToFrequency, midiToNote, normalizeNote, noteToMidi } from './music-theory';

describe('noteToMidi / midiToNote', () => {
  it('parses sharps, flats and multi-digit / negative octaves', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Db4')).toBe(61);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(noteToMidi('A0')).toBe(21);
    expect(noteToMidi('C-1')).toBe(0);
    expect(noteToMidi('C10')).toBe(132);
    expect(noteToMidi('B#3')).toBe(60);
    expect(noteToMidi('Cb4')).toBe(59);
  });

  it('rejects garbage', () => {
    expect(() => noteToMidi('H2')).toThrow();
    expect(() => noteToMidi('Kick')).toThrow();
  });

  it('round-trips with sharp spelling', () => {
    for (let m = 0; m < 128; m++) expect(noteToMidi(midiToNote(m))).toBe(m);
    expect(normalizeNote('Bb2')).toBe('A#2');
    expect(normalizeNote('Kick')).toBeNull();
  });

  it('tunes A4 to 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880);
  });
});

describe('getScaleNotes', () => {
  it('builds one octave from the root', () => {
    expect(getScaleNotes('C', 'major')).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
    expect(getScaleNotes('A', 'naturalMinor')).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5']);
    expect(getScaleNotes('D', 'pentatonic', 3)).toEqual(['D3', 'E3', 'F#3', 'A3', 'B3']);
    expect(getScaleNotes('Bb', 'major', 3)[0]).toBe('A#3');
  });

  it('returns nothing for an unknown root', () => {
    expect(getScaleNotes('X', 'major')).toEqual([]);
  });
});

describe('getChordNotes', () => {
  it('gives correct diatonic qualities in major', () => {
    const q = (d: number, seventh = false) => chordQuality(getChordNotes('C', 'major', d, seventh));
    expect([1, 2, 3, 4, 5, 6, 7].map(d => q(d))).toEqual(['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished']);
    expect(q(5, true)).toBe('dom7');
    expect(q(7, true)).toBe('m7b5');
    expect(getChordNotes('C', 'major', 1)).toEqual(['C4', 'E4', 'G4']);
  });

  it('gives correct diatonic qualities in natural minor (was wrong before)', () => {
    const q = (d: number) => chordQuality(getChordNotes('A', 'naturalMinor', d));
    expect([1, 2, 3, 4, 5, 6, 7].map(q)).toEqual(['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major']);
  });

  it('gives a major V and diminished vii° in harmonic minor', () => {
    expect(chordQuality(getChordNotes('A', 'harmonicMinor', 5))).toBe('major');
    expect(chordQuality(getChordNotes('A', 'harmonicMinor', 7, true))).toBe('dim7');
  });

  it('handles pentatonic scales', () => {
    expect(chordQuality(getChordNotes('C', 'pentatonic', 1))).toBe('major');
    expect(chordQuality(getChordNotes('A', 'minorPentatonic', 1))).toBe('minor');
  });
});

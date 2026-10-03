import { SAMPLE_SETS, SAMPLE_SET_ALIASES, getDrumSamplePath, getSampleSet, sampleUrl, samplesByDistance } from './sample-manifests';
import { INSTRUMENT_PRESETS, PLAYLIST_PRESETS } from './playlist-presets';
import { noteToMidi } from '../utils/music-theory';

describe('SAMPLE_SETS', () => {
  it('serves every sample from this app', () => {
    for (const set of Object.values(SAMPLE_SETS)) {
      expect(set.basePath, set.name).toBe(`samples/${set.name}/`);
      for (const file of set.samples.values()) expect(file, set.name).toMatch(/^[A-G]s?-?\d\.flac$/);
    }
  });

  it('maps filenames to the right pitch', () => {
    expect(sampleUrl(SAMPLE_SETS['acoustic-piano'], 69)).toBe('samples/acoustic-piano/A4.flac');
    expect(sampleUrl(SAMPLE_SETS['cello'], noteToMidi('C#3'))).toBe('samples/cello/Cs3.flac');
    expect(sampleUrl(SAMPLE_SETS['nylon-guitar'], noteToMidi('D#5'))).toBe('samples/nylon-guitar/Ds5.flac');
  });

  it('excludes the piano files that were wrong-pitch copies', () => {
    const piano = SAMPLE_SETS['acoustic-piano'];
    expect(sampleUrl(piano, noteToMidi('C#4'))).toBeNull();
    expect(samplesByDistance(piano, noteToMidi('C#4'))[0]).toBe(noteToMidi('C4'));
  });

  it('keeps old set names working for saved songs', () => {
    for (const [oldName, current] of Object.entries(SAMPLE_SET_ALIASES)) {
      expect(SAMPLE_SETS[current], oldName).toBeDefined();
      expect(getSampleSet(oldName)).toBe(SAMPLE_SETS[current]);
    }
  });

  it('every instrument preset and song track points at an existing sample set', () => {
    for (const inst of Object.values(INSTRUMENT_PRESETS)) {
      if (inst.sampleSet) expect(getSampleSet(inst.sampleSet), inst.name).toBeDefined();
    }
    for (const preset of PLAYLIST_PRESETS) {
      for (const t of preset.tracks) {
        if (t.sampleSet) expect(getSampleSet(t.sampleSet), `${preset.name}/${t.trackName}`).toBeDefined();
      }
    }
  });

  it('every set says how long it rings after the note ends', () => {
    for (const set of Object.values(SAMPLE_SETS)) expect(set.noteOffRelease, set.name).toBeGreaterThan(0);
  });

  it('every drum name has a sample', () => {
    for (const d of ['Kick', 'Snare', 'Hi-Hat', 'Open Hi-Hat', 'Tom Low', 'Tom Mid', 'Tom High', 'Ride', 'Crash', 'Clap']) {
      expect(getDrumSamplePath(d), d).toBe(`samples/drums/${({ 'Hi-Hat': 'hat-closed', 'Open Hi-Hat': 'hat-open' } as Record<string, string>)[d] ?? d.toLowerCase().replace(' ', '-')}.flac`);
    }
  });
});

describe('INSTRUMENT_PRESETS', () => {
  it('retro voices use only the four basic waves', () => {
    const basic = ['sine', 'square', 'triangle', 'sawtooth'];
    for (const inst of Object.values(INSTRUMENT_PRESETS)) {
      expect(basic, inst.name).toContain(inst.oscType);
      if (inst.osc2Type) expect(basic, inst.name).toContain(inst.osc2Type);
    }
  });

  it('every melodic instrument has both a realistic and a retro voice', () => {
    for (const inst of Object.values(INSTRUMENT_PRESETS)) {
      if (inst.name === 'drums') continue;
      expect(inst.sampleSet, `${inst.name} has no sample set`).toBeDefined();
      expect(inst.oscType, inst.name).toBeDefined();
    }
  });
});
